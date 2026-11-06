<?php
/**
 * Removes the plugin's data when it is deleted.
 *
 * @package NimbusPal
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'nimbuspal_settings' );
delete_option( 'nimbuspal_site_token_hash' );
