<?php
/**
 * The NimbusPal screen. Messages appear on this screen only: the plugin shows no admin-wide notices.
 *
 * @package NimbusPal
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The NimbusPal screen, with its own item in the main admin menu.
 */
class NimbusPal_Admin {

	const PAGE = 'nimbuspal';

	/**
	 * How long someone has to finish connecting, in seconds.
	 */
	const STATE_LIFETIME = 900;

	/**
	 * The cloud mascot for the menu. Its eyes and smile are cut out of the shape, so
	 * WordPress can recolor it to match each admin color scheme.
	 */
	const MENU_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 96"><path fill="black" fill-rule="evenodd" d="M32 84 C14 84 8 66 18 56 C10 42 24 26 40 32 C44 16 62 8 76 16 C90 10 106 22 102 38 C114 42 116 62 104 70 C102 80 94 84 86 84 Z M49 49 a7 7 0 1 0 0.01 0 Z M73 49 a7 7 0 1 0 0.01 0 Z M50 63 C53 75 69 75 72 63 C68 67 54 67 50 63 Z"/></svg>';

	/**
	 * Hooks the admin screens and form handlers.
	 */
	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'add_page' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( NIMBUSPAL_FILE ), array( __CLASS__, 'add_plugin_link' ) );
		add_action( 'admin_post_nimbuspal_save', array( __CLASS__, 'handle_save' ) );
		add_action( 'admin_post_nimbuspal_disconnect', array( __CLASS__, 'handle_disconnect' ) );
		add_action( 'admin_post_nimbuspal_connect_start', array( __CLASS__, 'handle_connect_start' ) );
		add_action( 'admin_post_nimbuspal_connect_return', array( __CLASS__, 'handle_connect_return' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue' ) );
	}

	/**
	 * When wp-admin runs inside a frame (WordPress Playground, for example), Connect opens in a
	 * new tab: NimbusPal's sign-in page refuses to load inside a frame, so no one can be tricked
	 * into approving a site.
	 *
	 * @param string $hook The current admin screen.
	 */
	public static function enqueue( $hook ) {
		if ( 'toplevel_page_' . self::PAGE !== $hook ) {
			return;
		}
		wp_register_script( 'nimbuspal-admin', false, array(), NIMBUSPAL_VERSION, true );
		wp_enqueue_script( 'nimbuspal-admin' );
		wp_add_inline_script(
			'nimbuspal-admin',
			'(function(){var f=document.getElementById("nimbuspal-connect-form");if(f&&window.top!==window.self){f.target="_blank";}})();'
		);
	}

	/**
	 * Adds the screen to the main menu. No position is given, so WordPress puts it at the end,
	 * below its own items.
	 */
	public static function add_page() {
		add_menu_page(
			__( 'NimbusPal', 'nimbuspal' ),
			__( 'NimbusPal', 'nimbuspal' ),
			'manage_options',
			self::PAGE,
			array( __CLASS__, 'render_page' ),
			'data:image/svg+xml;base64,' . base64_encode( self::MENU_ICON_SVG ) // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
		);
	}

	/**
	 * Adds a Settings link to the plugin's row on the Plugins screen.
	 *
	 * @param array $links Existing links.
	 * @return array
	 */
	public static function add_plugin_link( $links ) {
		array_unshift(
			$links,
			'<a href="' . esc_url( admin_url( 'admin.php?page=' . self::PAGE ) ) . '">' . esc_html__( 'Settings', 'nimbuspal' ) . '</a>'
		);
		return $links;
	}

	/**
	 * The transient that remembers this person's connection attempt.
	 *
	 * @return string
	 */
	private static function state_key() {
		return 'nimbuspal_connect_' . get_current_user_id();
	}

	/**
	 * One click: sends the owner to NimbusPal to sign in and approve this site.
	 */
	public static function handle_connect_start() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to do this.', 'nimbuspal' ), 403 );
		}
		check_admin_referer( 'nimbuspal_connect_start' );

		$state = wp_generate_password( 40, false );
		set_transient( self::state_key(), $state, self::STATE_LIFETIME );

		$url = add_query_arg(
			array(
				'site'   => rawurlencode( home_url( '/' ) ),
				'return' => rawurlencode( admin_url( 'admin-post.php?action=nimbuspal_connect_return' ) ),
				'state'  => $state,
				'name'   => rawurlencode( get_bloginfo( 'name' ) ),
			),
			NimbusPal_Options::app_url() . '/connect'
		);
		// phpcs:ignore WordPress.Security.SafeRedirect.wp_redirect_wp_redirect -- NimbusPal's address is fixed, not user input.
		wp_redirect( $url );
		exit;
	}

	/**
	 * NimbusPal sends the owner back here with a one-time code.
	 */
	public static function handle_connect_return() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to do this.', 'nimbuspal' ), 403 );
		}

		// The state check stands in for a nonce: only the person who started can finish.
		// phpcs:disable WordPress.Security.NonceVerification.Recommended
		$state = isset( $_GET['state'] ) ? sanitize_text_field( wp_unslash( $_GET['state'] ) ) : '';
		$code  = isset( $_GET['code'] ) ? sanitize_text_field( wp_unslash( $_GET['code'] ) ) : '';
		// phpcs:enable
		$expected = (string) get_transient( self::state_key() );
		delete_transient( self::state_key() );

		if ( '' === $code || '' === $expected || ! hash_equals( $expected, $state ) ) {
			self::redirect( 'expired' );
		}
		self::redirect( self::connect( $code ) );
	}

	/**
	 * Saves preferences and, when an API key was entered, connects to NimbusPal.
	 */
	public static function handle_save() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to do this.', 'nimbuspal' ), 403 );
		}
		check_admin_referer( 'nimbuspal_save' );

		$placement = isset( $_POST['placement'] ) ? sanitize_key( wp_unslash( $_POST['placement'] ) ) : 'auto';
		$position  = isset( $_POST['position'] ) ? sanitize_key( wp_unslash( $_POST['position'] ) ) : 'bottom-right';
		$api_url   = isset( $_POST['api_url'] ) ? esc_url_raw( trim( sanitize_text_field( wp_unslash( $_POST['api_url'] ) ) ), array( 'https', 'http' ) ) : '';
		$api_key   = isset( $_POST['api_key'] ) ? sanitize_text_field( wp_unslash( $_POST['api_key'] ) ) : '';

		NimbusPal_Options::update(
			array(
				'placement' => in_array( $placement, array( 'auto', 'shortcode' ), true ) ? $placement : 'auto',
				'position'  => in_array( $position, array( 'bottom-right', 'bottom-left' ), true ) ? $position : 'bottom-right',
				'api_url'   => '' !== $api_url ? untrailingslashit( $api_url ) : NimbusPal_Options::DEFAULT_API_URL,
			)
		);

		$notice = 'saved';
		if ( '' !== $api_key ) {
			$notice = self::connect( $api_key );
		}
		self::redirect( $notice );
	}

	/**
	 * Forgets the connection.
	 */
	public static function handle_disconnect() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to do this.', 'nimbuspal' ), 403 );
		}
		check_admin_referer( 'nimbuspal_disconnect' );
		NimbusPal_Options::disconnect();
		self::redirect( 'disconnected' );
	}

	/**
	 * Exchanges an API key or one-click code for this site's credentials. Neither is stored.
	 *
	 * @param string $credential The API key or code from NimbusPal.
	 * @return string Notice code.
	 */
	private static function connect( $credential ) {
		$settings = NimbusPal_Options::get();

		$response = wp_remote_post(
			$settings['api_url'] . '/sites/connect',
			array(
				'timeout' => 15,
				'headers' => array(
					'Authorization' => 'Bearer ' . $credential,
					'Content-Type'  => 'application/json',
				),
				'body'    => wp_json_encode(
					array(
						'siteUrl'           => home_url( '/' ),
						'restBaseUrl'       => rest_url( NimbusPal_Rest::REST_NAMESPACE ),
						'platform'          => 'wordpress',
						'pluginVersion'     => NIMBUSPAL_VERSION,
						'woocommerceActive' => NimbusPal_Rest::woocommerce_active(),
					)
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return 'unreachable';
		}

		$status = (int) wp_remote_retrieve_response_code( $response );
		$body   = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( 401 === $status ) {
			return 'bad_key';
		}
		if ( 400 === $status ) {
			return 'bad_site';
		}
		if ( 200 !== $status || ! is_array( $body ) || empty( $body['publicKey'] ) || empty( $body['siteToken'] ) ) {
			return 'failed';
		}

		NimbusPal_Options::save_token( (string) $body['siteToken'] );
		NimbusPal_Options::update( array( 'public_key' => sanitize_text_field( (string) $body['publicKey'] ) ) );
		return 'connected';
	}

	/**
	 * Returns to the screen with a message code.
	 *
	 * @param string $notice Notice code.
	 */
	private static function redirect( $notice ) {
		wp_safe_redirect(
			add_query_arg(
				array(
					'page'             => self::PAGE,
					'nimbuspal_notice' => $notice,
				),
				admin_url( 'admin.php' )
			)
		);
		exit;
	}

	/**
	 * The message for a notice code.
	 *
	 * @param string $code Notice code.
	 * @return array{0:string,1:string}|null Type and message.
	 */
	private static function notice_for( $code ) {
		$notices = array(
			'saved'        => array( 'success', __( 'Settings saved.', 'nimbuspal' ) ),
			'connected'    => array( 'success', __( 'You are connected! The helper is now on your site.', 'nimbuspal' ) ),
			'disconnected' => array( 'success', __( 'Disconnected from NimbusPal. The helper no longer appears on your site.', 'nimbuspal' ) ),
			'expired'      => array( 'error', __( 'That connection expired. Please click the button to try again.', 'nimbuspal' ) ),
			'bad_key'      => array( 'error', __( 'That was not accepted. Please click the button to try again.', 'nimbuspal' ) ),
			'bad_site'     => array( 'error', __( 'NimbusPal could not accept this site address. Your site needs a public https:// address.', 'nimbuspal' ) ),
			'unreachable'  => array( 'error', __( 'Could not reach NimbusPal. Please try again in a moment.', 'nimbuspal' ) ),
			'failed'       => array( 'error', __( 'Connecting failed. Please try again.', 'nimbuspal' ) ),
		);
		return isset( $notices[ $code ] ) ? $notices[ $code ] : null;
	}

	/**
	 * Renders the screen.
	 */
	public static function render_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$settings  = NimbusPal_Options::get();
		$connected = NimbusPal_Options::is_connected();
		// Only selects a fixed message, and changes nothing, so no nonce is needed.
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$code   = isset( $_GET['nimbuspal_notice'] ) ? sanitize_key( wp_unslash( $_GET['nimbuspal_notice'] ) ) : '';
		$notice = self::notice_for( $code );
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'NimbusPal', 'nimbuspal' ); ?></h1>

			<?php if ( $notice ) : ?>
				<div class="notice notice-<?php echo esc_attr( $notice[0] ); ?>"><p><?php echo esc_html( $notice[1] ); ?></p></div>
			<?php endif; ?>

			<div class="card" style="max-width:640px;">
				<?php if ( $connected ) : ?>
					<h2><?php esc_html_e( 'You are connected', 'nimbuspal' ); ?></h2>
					<p><?php esc_html_e( 'Your helper is live. Manage conversations and settings in your NimbusPal dashboard.', 'nimbuspal' ); ?></p>
					<p>
						<a class="button button-primary button-hero" href="<?php echo esc_url( NimbusPal_Options::app_url() ); ?>" target="_blank" rel="noopener noreferrer"><?php esc_html_e( 'Open my dashboard', 'nimbuspal' ); ?></a>
					</p>
				<?php else : ?>
					<h2><?php esc_html_e( 'Connect your site in one click', 'nimbuspal' ); ?></h2>
					<p><?php esc_html_e( 'Sign in or create a free NimbusPal account, approve this site, and you will come straight back here, connected.', 'nimbuspal' ); ?></p>
					<form id="nimbuspal-connect-form" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
						<input type="hidden" name="action" value="nimbuspal_connect_start" />
						<?php wp_nonce_field( 'nimbuspal_connect_start' ); ?>
						<?php submit_button( __( 'Connect to NimbusPal', 'nimbuspal' ), 'primary hero', 'nimbuspal-connect', false ); ?>
					</form>
				<?php endif; ?>
				<p class="description" style="margin-top:12px;">
					<?php esc_html_e( 'NimbusPal is an external service. Connecting sends your site address, plugin version and whether WooCommerce is active. Once connected, messages visitors type in the helper are sent to NimbusPal.', 'nimbuspal' ); ?>
				</p>
			</div>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="nimbuspal_save" />
				<?php wp_nonce_field( 'nimbuspal_save' ); ?>

				<h2><?php esc_html_e( 'Display', 'nimbuspal' ); ?></h2>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="nimbuspal-placement"><?php esc_html_e( 'Where to show the helper', 'nimbuspal' ); ?></label></th>
						<td>
							<select id="nimbuspal-placement" name="placement">
								<option value="auto" <?php selected( $settings['placement'], 'auto' ); ?>><?php esc_html_e( 'On every page', 'nimbuspal' ); ?></option>
								<option value="shortcode" <?php selected( $settings['placement'], 'shortcode' ); ?>><?php esc_html_e( 'Only where I add the shortcode', 'nimbuspal' ); ?></option>
							</select>
							<p class="description">
								<?php
								/* translators: %s: the shortcode */
								printf( esc_html__( 'Add %s to a page to place the chat inside that page.', 'nimbuspal' ), '<code>[nimbuspal]</code>' );
								?>
							</p>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="nimbuspal-position"><?php esc_html_e( 'Corner', 'nimbuspal' ); ?></label></th>
						<td>
							<select id="nimbuspal-position" name="position">
								<option value="bottom-right" <?php selected( $settings['position'], 'bottom-right' ); ?>><?php esc_html_e( 'Bottom right', 'nimbuspal' ); ?></option>
								<option value="bottom-left" <?php selected( $settings['position'], 'bottom-left' ); ?>><?php esc_html_e( 'Bottom left', 'nimbuspal' ); ?></option>
							</select>
						</td>
					</tr>
				</table>

				<details style="max-width:640px;margin-bottom:16px;">
					<summary style="cursor:pointer;"><?php esc_html_e( 'Advanced: connect with an API key', 'nimbuspal' ); ?></summary>
					<table class="form-table" role="presentation">
						<tr>
							<th scope="row"><label for="nimbuspal-api-key"><?php esc_html_e( 'API key', 'nimbuspal' ); ?></label></th>
							<td>
								<input type="password" id="nimbuspal-api-key" name="api_key" class="regular-text" autocomplete="off" value="" />
								<p class="description"><?php esc_html_e( 'Most people do not need this. Used once to connect and not stored.', 'nimbuspal' ); ?></p>
							</td>
						</tr>
						<tr>
							<th scope="row"><label for="nimbuspal-api-url"><?php esc_html_e( 'API address', 'nimbuspal' ); ?></label></th>
							<td>
								<input type="url" id="nimbuspal-api-url" name="api_url" class="regular-text code" value="<?php echo esc_attr( $settings['api_url'] ); ?>" />
								<p class="description"><?php esc_html_e( 'Leave this as it is unless NimbusPal support asks you to change it.', 'nimbuspal' ); ?></p>
							</td>
						</tr>
					</table>
				</details>
				<?php submit_button( __( 'Save settings', 'nimbuspal' ) ); ?>
			</form>

			<?php if ( $connected ) : ?>
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
					<input type="hidden" name="action" value="nimbuspal_disconnect" />
					<?php wp_nonce_field( 'nimbuspal_disconnect' ); ?>
					<?php submit_button( __( 'Disconnect', 'nimbuspal' ), 'secondary' ); ?>
				</form>
			<?php endif; ?>
		</div>
		<?php
	}
}
