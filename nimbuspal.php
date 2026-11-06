<?php
/**
 * Plugin Name:       NimbusPal
 * Plugin URI:        https://nimbuspal.com/
 * Description:       Adds a friendly customer support helper to your site. Connects to the external NimbusPal service.
 * Version:           0.2.0
 * Requires at least: 6.3
 * Requires PHP:      7.4
 * Author:            NimbusPal
 * Author URI:        https://nimbuspal.com/
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       nimbuspal
 *
 * @package NimbusPal
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'NIMBUSPAL_VERSION', '0.2.0' );
define( 'NIMBUSPAL_FILE', __FILE__ );
define( 'NIMBUSPAL_DIR', plugin_dir_path( __FILE__ ) );

require_once NIMBUSPAL_DIR . 'includes/class-nimbuspal-options.php';
require_once NIMBUSPAL_DIR . 'includes/class-nimbuspal-rest.php';
require_once NIMBUSPAL_DIR . 'includes/class-nimbuspal-frontend.php';

add_action( 'rest_api_init', array( 'NimbusPal_Rest', 'register_routes' ) );
add_action( 'wp_enqueue_scripts', array( 'NimbusPal_Frontend', 'enqueue' ) );
add_action( 'init', array( 'NimbusPal_Frontend', 'register_shortcode' ) );

if ( is_admin() ) {
	require_once NIMBUSPAL_DIR . 'includes/class-nimbuspal-admin.php';
	NimbusPal_Admin::init();
}
