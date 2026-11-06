<?php
/**
 * Dependency-free tests for the security-sensitive REST code. WordPress and
 * WooCommerce are replaced by small stand-ins, so this checks the plugin's own logic,
 * not its behavior inside a real WordPress install.
 *
 * Run: php tests/run-tests.php
 *
 * @package NimbusPal
 */

define( 'ABSPATH', __DIR__ . '/' );

// ---- WordPress stand-ins ----------------------------------------------------
$GLOBALS['np_options'] = array();
$GLOBALS['np_routes']  = array();
$GLOBALS['np_orders']  = array();

function get_option( $name, $default = false ) {
	return array_key_exists( $name, $GLOBALS['np_options'] ) ? $GLOBALS['np_options'][ $name ] : $default;
}
function update_option( $name, $value, $autoload = null ) {
	$GLOBALS['np_options'][ $name ] = $value;
	return true;
}
function delete_option( $name ) {
	unset( $GLOBALS['np_options'][ $name ] );
	return true;
}
function __( $text, $domain = null ) {
	return $text;
}
function register_rest_route( $namespace, $route, $args ) {
	$GLOBALS['np_routes'][ $namespace . $route ] = $args;
}
function wc_get_order_status_name( $status ) {
	return ucfirst( $status );
}
function wc_get_order( $id ) {
	return isset( $GLOBALS['np_orders'][ $id ] ) ? $GLOBALS['np_orders'][ $id ] : false;
}

class WP_Error {
	public $code;
	public $data;
	public function __construct( $code, $message = '', $data = array() ) {
		$this->code = $code;
		$this->data = $data;
	}
}
class WP_REST_Response {
	public $data;
	public $status;
	public $headers = array();
	public function __construct( $data, $status ) {
		$this->data   = $data;
		$this->status = $status;
	}
	public function header( $name, $value ) {
		$this->headers[ $name ] = $value;
	}
}
class FakeRequest {
	private $headers;
	private $params;
	public function __construct( $headers = array(), $params = array() ) {
		$this->headers = $headers;
		$this->params  = $params;
	}
	public function get_header( $name ) {
		return isset( $this->headers[ $name ] ) ? $this->headers[ $name ] : null;
	}
	public function get_param( $name ) {
		return isset( $this->params[ $name ] ) ? $this->params[ $name ] : null;
	}
}

// ---- WooCommerce stand-ins --------------------------------------------------
class FakeItem {
	public function get_name() {
		return 'House Blend, 250g';
	}
	public function get_quantity() {
		return 2;
	}
}
class FakeDate {
	public function date( $format ) {
		return '2026-11-01T10:00:00+00:00';
	}
}
class WC_Order {
	public $email = 'Buyer@Example.com';
	public function get_billing_email() {
		return $this->email;
	}
	public function get_items() {
		return array( new FakeItem() );
	}
	public function get_date_created() {
		return new FakeDate();
	}
	public function get_status() {
		return 'processing';
	}
	public function get_order_number() {
		return '1042';
	}
	public function get_total() {
		return '19.50';
	}
	public function get_currency() {
		return 'USD';
	}
	public function get_billing_phone() {
		return '555-SECRET';
	}
	public function get_billing_address_1() {
		return '1 Secret Street';
	}
}
class FakeRefund {}

require_once __DIR__ . '/../includes/class-nimbuspal-options.php';
require_once __DIR__ . '/../includes/class-nimbuspal-rest.php';

// ---- Harness ----------------------------------------------------------------
$failures = 0;
$passed   = 0;

function check( $name, $condition ) {
	global $failures, $passed;
	if ( $condition ) {
		$passed++;
		echo "ok   - {$name}\n";
	} else {
		$failures++;
		echo "FAIL - {$name}\n";
	}
}
function is_status( $result, $status ) {
	return $result instanceof WP_Error && $result->data['status'] === $status;
}
function lookup( $number, $email ) {
	return NimbusPal_Rest::get_order( new FakeRequest( array(), array( 'orderNumber' => $number, 'email' => $email ) ) );
}

// ---- Routes without WooCommerce ---------------------------------------------
NimbusPal_Rest::register_routes();
check( 'no store route is registered without WooCommerce', array() === $GLOBALS['np_routes'] );

class_alias( 'FakeRefund', 'WooCommerce' );

NimbusPal_Rest::register_routes();
$route = isset( $GLOBALS['np_routes']['nimbuspal/v1/get-order'] ) ? $GLOBALS['np_routes']['nimbuspal/v1/get-order'] : null;
check( 'get-order is registered with WooCommerce', null !== $route );
check( 'get-order accepts POST only', $route && 'POST' === $route['methods'] );
check( 'get-order has a real permission check', $route && array( 'NimbusPal_Rest', 'verify_site_token' ) === $route['permission_callback'] );

// ---- Site token -------------------------------------------------------------
$verify = function ( $headers ) {
	return NimbusPal_Rest::verify_site_token( new FakeRequest( $headers ) );
};
check( 'rejects any token when the site is not connected', is_status( $verify( array( 'x-nimbuspal-site-token' => 'anything' ) ), 401 ) );

NimbusPal_Options::save_token( 'np_st_correct' );
check( 'stores only a hash of the token', hash( 'sha256', 'np_st_correct' ) === get_option( 'nimbuspal_site_token_hash' ) );
check( 'accepts the correct token', true === $verify( array( 'x-nimbuspal-site-token' => 'np_st_correct' ) ) );
check( 'rejects a wrong token', is_status( $verify( array( 'x-nimbuspal-site-token' => 'np_st_wrong' ) ), 401 ) );
check( 'rejects a missing token', is_status( $verify( array() ), 401 ) );
check( 'rejects the stored hash used as a token', is_status( $verify( array( 'x-nimbuspal-site-token' => hash( 'sha256', 'np_st_correct' ) ) ), 401 ) );

NimbusPal_Options::disconnect();
check( 'rejects the old token after disconnecting', is_status( $verify( array( 'x-nimbuspal-site-token' => 'np_st_correct' ) ), 401 ) );

// ---- Order lookup -----------------------------------------------------------
$GLOBALS['np_orders'][1042] = new WC_Order();
$GLOBALS['np_orders'][7]    = new FakeRefund();

$result = lookup( '1042', 'buyer@example.com' );
check( 'returns the order when number and email match', $result instanceof WP_REST_Response && 200 === $result->status );
check( 'email match ignores case and spaces', lookup( '#1042', '  BUYER@example.COM ' ) instanceof WP_REST_Response );
check( 'response is not cacheable', 'no-store' === $result->headers['Cache-Control'] );
check(
	'returns exactly the documented fields',
	array( 'orderNumber', 'status', 'statusLabel', 'createdAt', 'total', 'currency', 'items' ) === array_keys( $result->data )
);
$encoded = json_encode( $result->data );
check( 'does not expose email, phone or address', false === stripos( $encoded, 'example.com' ) && false === strpos( $encoded, 'SECRET' ) && false === strpos( $encoded, 'Secret' ) );
check( 'lists item names and quantities', array( array( 'name' => 'House Blend, 250g', 'quantity' => 2 ) ) === $result->data['items'] );

$wrong_email = lookup( '1042', 'other@example.com' );
$no_order    = lookup( '9999', 'buyer@example.com' );
check( 'a wrong email returns 404', is_status( $wrong_email, 404 ) );
check( 'a missing order returns 404', is_status( $no_order, 404 ) );
check( 'wrong email and missing order look identical', $wrong_email->code === $no_order->code );
check( 'a refund object is not treated as an order', is_status( lookup( '7', 'buyer@example.com' ), 404 ) );
check( 'an empty email is rejected', is_status( lookup( '1042', '' ), 404 ) );
check( 'a non-numeric order number is rejected', is_status( lookup( '1042 OR 1=1', 'buyer@example.com' ), 404 ) );

$GLOBALS['np_orders'][1042]->email = '';
check( 'an order with no email cannot match an empty value', is_status( lookup( '1042', '' ), 404 ) );

// ---- Plugin has no write calls ----------------------------------------------
$source = file_get_contents( __DIR__ . '/../includes/class-nimbuspal-rest.php' );
check(
	'REST code calls nothing that changes an order',
	! preg_match( '/->(save|update_status|set_[a-z_]+|delete|add_order_note|payment_complete)\s*\(|wc_create_refund/', $source )
);

echo "\n{$passed} passed, {$failures} failed\n";
exit( $failures > 0 ? 1 : 0 );
