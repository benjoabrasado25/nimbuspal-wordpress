<?php
/**
 * Read-only REST endpoints, for the NimbusPal backend only.
 *
 * @package NimbusPal
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers and answers the plugin's REST routes. Nothing here changes store data.
 */
class NimbusPal_Rest {

	const REST_NAMESPACE = 'nimbuspal/v1';

	/**
	 * Whether WooCommerce is active.
	 *
	 * @return bool
	 */
	public static function woocommerce_active() {
		return class_exists( 'WooCommerce' ) && function_exists( 'wc_get_order' );
	}

	/**
	 * Registers routes. Store endpoints exist only when WooCommerce is active.
	 */
	public static function register_routes() {
		if ( ! self::woocommerce_active() ) {
			return;
		}

		$order_args = array(
			'orderNumber' => array(
				'type'     => 'string',
				'required' => true,
			),
			'email'       => array(
				'type'     => 'string',
				'required' => true,
			),
		);

		// POST so a customer's email stays out of URLs and server access logs.
		register_rest_route(
			self::REST_NAMESPACE,
			'/get-order',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'get_order' ),
				'permission_callback' => array( __CLASS__, 'verify_site_token' ),
				'args'                => $order_args,
			)
		);

		register_rest_route(
			self::REST_NAMESPACE,
			'/get-tracking',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'get_tracking' ),
				'permission_callback' => array( __CLASS__, 'verify_site_token' ),
				'args'                => $order_args,
			)
		);

		register_rest_route(
			self::REST_NAMESPACE,
			'/search-products',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'search_products' ),
				'permission_callback' => array( __CLASS__, 'verify_site_token' ),
				'args'                => array(
					'query' => array(
						'type'     => 'string',
						'required' => true,
					),
				),
			)
		);
	}

	/**
	 * Checks the site token on every request.
	 *
	 * @param WP_REST_Request $request The request.
	 * @return true|WP_Error
	 */
	public static function verify_site_token( $request ) {
		$stored   = NimbusPal_Options::token_hash();
		$provided = (string) $request->get_header( 'x-nimbuspal-site-token' );

		if ( '' === $stored || '' === $provided || ! hash_equals( $stored, hash( 'sha256', $provided ) ) ) {
			return new WP_Error(
				'nimbuspal_unauthorized',
				__( 'Invalid site token.', 'nimbuspal' ),
				array( 'status' => 401 )
			);
		}
		return true;
	}

	/**
	 * The response for no match. A wrong email gets the same response as an order that
	 * does not exist, so order numbers cannot be probed.
	 *
	 * @return WP_Error
	 */
	private static function not_found() {
		return new WP_Error(
			'nimbuspal_order_not_found',
			__( 'No matching order.', 'nimbuspal' ),
			array( 'status' => 404 )
		);
	}

	/**
	 * Finds an order only when the order number and billing email both match.
	 *
	 * @param WP_REST_Request $request The request.
	 * @return WC_Order|null
	 */
	private static function find_order( $request ) {
		$number = ltrim( trim( (string) $request->get_param( 'orderNumber' ) ), '#' );
		$email  = strtolower( trim( (string) $request->get_param( 'email' ) ) );

		if ( '' === $email || ! ctype_digit( $number ) ) {
			return null;
		}

		$order = wc_get_order( (int) $number );
		// wc_get_order can also return a refund object, which is not a customer order.
		if ( ! ( $order instanceof WC_Order ) ) {
			return null;
		}

		$billing_email = strtolower( trim( (string) $order->get_billing_email() ) );
		if ( '' === $billing_email || ! hash_equals( $billing_email, $email ) ) {
			return null;
		}
		return $order;
	}

	/**
	 * Marks a response as private.
	 *
	 * @param array $data Response data.
	 * @return WP_REST_Response
	 */
	private static function respond( array $data ) {
		$response = new WP_REST_Response( $data, 200 );
		$response->header( 'Cache-Control', 'no-store' );
		return $response;
	}

	/**
	 * Returns a minimal order summary. No address, phone or payment details are returned.
	 *
	 * @param WP_REST_Request $request The request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function get_order( $request ) {
		$order = self::find_order( $request );
		if ( ! $order ) {
			return self::not_found();
		}

		$items = array();
		foreach ( $order->get_items() as $item ) {
			$items[] = array(
				'name'     => $item->get_name(),
				'quantity' => (int) $item->get_quantity(),
			);
		}

		$created = $order->get_date_created();
		$status  = $order->get_status();

		return self::respond(
			array(
				'orderNumber' => (string) $order->get_order_number(),
				'status'      => $status,
				'statusLabel' => wc_get_order_status_name( $status ),
				'createdAt'   => $created ? $created->date( 'c' ) : null,
				'total'       => (string) $order->get_total(),
				'currency'    => $order->get_currency(),
				'items'       => $items,
			)
		);
	}

	/**
	 * Returns shipment tracking from the WooCommerce Shipment Tracking data format, when
	 * an order has it. WooCommerce has no built-in tracking, so this may be an empty list.
	 *
	 * @param WP_REST_Request $request The request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function get_tracking( $request ) {
		$order = self::find_order( $request );
		if ( ! $order ) {
			return self::not_found();
		}

		$shipments = array();
		$stored    = $order->get_meta( '_wc_shipment_tracking_items', true );
		foreach ( is_array( $stored ) ? $stored : array() as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}
			$shipped = isset( $item['date_shipped'] ) && is_numeric( $item['date_shipped'] ) ? gmdate( 'c', (int) $item['date_shipped'] ) : null;
			$url     = isset( $item['custom_tracking_link'] ) ? (string) $item['custom_tracking_link'] : '';

			$shipments[] = array(
				'provider'       => ! empty( $item['tracking_provider'] ) ? (string) $item['tracking_provider'] : ( ! empty( $item['custom_tracking_provider'] ) ? (string) $item['custom_tracking_provider'] : null ),
				'trackingNumber' => ! empty( $item['tracking_number'] ) ? (string) $item['tracking_number'] : null,
				'trackingUrl'    => '' !== $url && preg_match( '#^https?://#i', $url ) ? $url : null,
				'shippedAt'      => $shipped,
			);
		}

		$status = $order->get_status();
		return self::respond(
			array(
				'orderNumber' => (string) $order->get_order_number(),
				'status'      => $status,
				'statusLabel' => wc_get_order_status_name( $status ),
				'shipments'   => $shipments,
			)
		);
	}

	/**
	 * Searches published, visible products. Only what any shopper can already see.
	 *
	 * @param WP_REST_Request $request The request.
	 * @return WP_REST_Response
	 */
	public static function search_products( $request ) {
		$query = sanitize_text_field( (string) $request->get_param( 'query' ) );
		if ( '' === $query ) {
			return self::respond( array( 'products' => array() ) );
		}

		$products = wc_get_products(
			array(
				's'          => $query,
				'status'     => 'publish',
				'visibility' => 'visible',
				'limit'      => 5,
			)
		);

		$currency = get_woocommerce_currency();
		$results  = array();
		foreach ( $products as $product ) {
			$price     = $product->get_price();
			$results[] = array(
				'name'     => $product->get_name(),
				'price'    => '' === $price ? null : (string) $price,
				'currency' => $currency,
				'inStock'  => (bool) $product->is_in_stock(),
				'url'      => (string) $product->get_permalink(),
			);
		}
		return self::respond( array( 'products' => $results ) );
	}
}
