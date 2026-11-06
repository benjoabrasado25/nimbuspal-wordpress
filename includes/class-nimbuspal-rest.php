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

		// POST so a customer's email stays out of URLs and server access logs.
		register_rest_route(
			self::REST_NAMESPACE,
			'/get-order',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'get_order' ),
				'permission_callback' => array( __CLASS__, 'verify_site_token' ),
				'args'                => array(
					'orderNumber' => array(
						'type'     => 'string',
						'required' => true,
					),
					'email'       => array(
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
	 * Returns a minimal order summary when the order number and billing email match.
	 *
	 * A wrong email gets the same response as an order that does not exist, so order
	 * numbers cannot be probed. No address, phone or payment details are returned.
	 *
	 * @param WP_REST_Request $request The request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function get_order( $request ) {
		$not_found = new WP_Error(
			'nimbuspal_order_not_found',
			__( 'No matching order.', 'nimbuspal' ),
			array( 'status' => 404 )
		);

		$number = ltrim( trim( (string) $request->get_param( 'orderNumber' ) ), '#' );
		$email  = strtolower( trim( (string) $request->get_param( 'email' ) ) );

		if ( '' === $email || ! ctype_digit( $number ) ) {
			return $not_found;
		}

		$order = wc_get_order( (int) $number );
		// wc_get_order can also return a refund object, which is not a customer order.
		if ( ! ( $order instanceof WC_Order ) ) {
			return $not_found;
		}

		$billing_email = strtolower( trim( (string) $order->get_billing_email() ) );
		if ( '' === $billing_email || ! hash_equals( $billing_email, $email ) ) {
			return $not_found;
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

		$response = new WP_REST_Response(
			array(
				'orderNumber' => (string) $order->get_order_number(),
				'status'      => $status,
				'statusLabel' => wc_get_order_status_name( $status ),
				'createdAt'   => $created ? $created->date( 'c' ) : null,
				'total'       => (string) $order->get_total(),
				'currency'    => $order->get_currency(),
				'items'       => $items,
			),
			200
		);
		$response->header( 'Cache-Control', 'no-store' );
		return $response;
	}
}
