<?php
/**
 * Stored settings.
 *
 * @package NimbusPal
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reads and writes the plugin's options.
 *
 * The API key is never stored: it is used once to connect and then discarded. The
 * site token is stored only as a hash, so a copy of the database cannot be used to
 * call this site's endpoints.
 */
class NimbusPal_Options {

	const SETTINGS_OPTION   = 'nimbuspal_settings';
	const TOKEN_HASH_OPTION = 'nimbuspal_site_token_hash';
	const DEFAULT_API_URL   = 'https://api.nimbuspal.com';

	/**
	 * Current settings merged with defaults.
	 *
	 * @return array{api_url:string,public_key:string,placement:string,position:string}
	 */
	public static function get() {
		$saved = get_option( self::SETTINGS_OPTION, array() );
		return array_merge(
			array(
				'api_url'    => self::DEFAULT_API_URL,
				'public_key' => '',
				'placement'  => 'auto',
				'position'   => 'bottom-right',
			),
			is_array( $saved ) ? $saved : array()
		);
	}

	/**
	 * Saves some settings, leaving the rest unchanged.
	 *
	 * @param array $changes Settings to change.
	 */
	public static function update( array $changes ) {
		update_option( self::SETTINGS_OPTION, array_merge( self::get(), $changes ) );
	}

	/**
	 * Whether this site has connected to NimbusPal.
	 *
	 * @return bool
	 */
	public static function is_connected() {
		$settings = self::get();
		return '' !== $settings['public_key'] && '' !== self::token_hash();
	}

	/**
	 * The stored hash of the site token.
	 *
	 * @return string
	 */
	public static function token_hash() {
		return (string) get_option( self::TOKEN_HASH_OPTION, '' );
	}

	/**
	 * Stores a site token as a hash.
	 *
	 * @param string $site_token The token issued by NimbusPal.
	 */
	public static function save_token( $site_token ) {
		update_option( self::TOKEN_HASH_OPTION, hash( 'sha256', $site_token ), false );
	}

	/**
	 * Forgets the connection and keeps display preferences.
	 */
	public static function disconnect() {
		delete_option( self::TOKEN_HASH_OPTION );
		self::update( array( 'public_key' => '' ) );
	}
}
