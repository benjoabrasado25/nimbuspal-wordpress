<?php
/**
 * Adds the helper to public pages.
 *
 * @package NimbusPal
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Loads the bundled widget and provides the [nimbuspal] shortcode.
 */
class NimbusPal_Frontend {

	const HANDLE = 'nimbuspal-widget';

	/**
	 * Registers the bundled widget, and enqueues it when auto-insert is on.
	 */
	public static function enqueue() {
		if ( ! NimbusPal_Options::is_connected() ) {
			return;
		}

		$settings = NimbusPal_Options::get();

		wp_register_script(
			self::HANDLE,
			plugins_url( 'assets/widget/nimbuspal-widget.js', NIMBUSPAL_FILE ),
			array(),
			NIMBUSPAL_VERSION,
			array(
				'in_footer' => true,
				'strategy'  => 'defer',
			)
		);

		wp_add_inline_script(
			self::HANDLE,
			'window.NimbusPalConfig = ' . wp_json_encode(
				array(
					'apiUrl'   => $settings['api_url'],
					'siteKey'  => $settings['public_key'],
					'position' => $settings['position'],
				)
			) . ';',
			'before'
		);

		if ( 'auto' === $settings['placement'] ) {
			wp_enqueue_script( self::HANDLE );
		}
	}

	/**
	 * Registers the shortcode.
	 */
	public static function register_shortcode() {
		add_shortcode( 'nimbuspal', array( __CLASS__, 'render_shortcode' ) );
	}

	/**
	 * Places the chat inside the page content.
	 *
	 * @return string
	 */
	public static function render_shortcode() {
		if ( ! NimbusPal_Options::is_connected() ) {
			return '';
		}
		wp_enqueue_script( self::HANDLE );
		return '<div data-nimbuspal-inline></div>';
	}
}
