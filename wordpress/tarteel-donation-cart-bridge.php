<?php
/**
 * Plugin Name: Tarteel Donation Cart Bridge
 * Description: Adds the approved General Donation product to the WooCommerce cart from the Tarteel Academy modal.
 * Version: 1.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const TARTEEL_DONATION_MIN_AMOUNT = 1.00;
const TARTEEL_DONATION_MAX_AMOUNT = 100000.00;
const TARTEEL_DONATION_CONFIRM_TTL = 120;

function tarteel_donation_allowed_origins() {
	return array(
		'https://super-firefly-660f.itnanotech1.workers.dev',
	);
}

function tarteel_donation_validate_origin( $origin ) {
	$origin = untrailingslashit( esc_url_raw( $origin ) );
	return in_array( $origin, tarteel_donation_allowed_origins(), true ) ? $origin : '';
}

function tarteel_donation_is_approved_product( $product ) {
	if ( ! $product instanceof WC_Product ) {
		return false;
	}

	$slug = strtolower( (string) $product->get_slug() );
	$name = strtolower( trim( wp_strip_all_tags( (string) $product->get_name() ) ) );

	return 'donte' === $slug || 'general donation' === $name;
}

/**
 * Load WooCommerce frontend dependencies and create a real customer session/cart.
 * admin-post.php is an admin request, so WooCommerce does not always bootstrap
 * its frontend cart automatically for a brand-new visitor.
 *
 * @return bool
 */
function tarteel_donation_boot_cart() {
	if ( ! function_exists( 'WC' ) || ! class_exists( 'WooCommerce' ) ) {
		return false;
	}

	if ( method_exists( WC(), 'frontend_includes' ) ) {
		WC()->frontend_includes();
	}

	if ( function_exists( 'wc_load_cart' ) && ( null === WC()->session || null === WC()->cart ) ) {
		wc_load_cart();
	}

	if ( null === WC()->customer && class_exists( 'WC_Customer' ) ) {
		WC()->customer = new WC_Customer( get_current_user_id(), true );
	}

	return WC()->session && WC()->cart;
}

function tarteel_donation_bridge_response( $status, $message, $target_origin, $http_status = 200 ) {
	$status  = 'success' === $status ? 'success' : 'error';
	$payload = wp_json_encode(
		array(
			'source'  => 'tarteel-donation-bridge',
			'status'  => $status,
			'message' => $message,
		)
	);
	$origin = wp_json_encode( $target_origin );
	$nonce  = str_replace( '-', '', wp_generate_uuid4() );

	status_header( $http_status );
	nocache_headers();
	header( 'Content-Type: text/html; charset=' . get_option( 'blog_charset' ) );
	header( "Content-Security-Policy: default-src 'none'; script-src 'nonce-{$nonce}'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'" );
	header( 'X-Content-Type-Options: nosniff' );
	header( 'Referrer-Policy: no-referrer' );
	?>
	<!doctype html>
	<html lang="en">
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width,initial-scale=1">
		<title>Tarteel Donation</title>
	</head>
	<body style="margin:0;padding:32px;background:#fffaf2;color:#071d3f;font:16px/1.5 Arial,sans-serif;text-align:center">
		<p><?php echo esc_html( $message ); ?></p>
		<script nonce="<?php echo esc_attr( $nonce ); ?>">
		(function () {
			var payload = <?php echo $payload; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>;
			var targetOrigin = <?php echo $origin; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>;
			if (window.opener && targetOrigin) {
				window.opener.postMessage(payload, targetOrigin);
			}
			window.setTimeout(function () { window.close(); }, 900);
		}());
		</script>
	</body>
	</html>
	<?php
	exit;
}

/**
 * Add the donation, save the fresh WooCommerce session, then perform a
 * same-origin confirmation redirect. Following the redirect forces a new
 * browser to commit and resend the WooCommerce session cookie before the
 * popup reports success to the Tarteel modal.
 */
function tarteel_donation_bridge_handle() {
	$target_origin = isset( $_POST['return_origin'] )
		? tarteel_donation_validate_origin( wp_unslash( $_POST['return_origin'] ) )
		: '';

	if ( 'POST' !== strtoupper( isset( $_SERVER['REQUEST_METHOD'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_METHOD'] ) ) : '' ) ) {
		tarteel_donation_bridge_response( 'error', 'Invalid request method.', $target_origin, 405 );
	}

	if ( '' === $target_origin ) {
		tarteel_donation_bridge_response( 'error', 'This website is not authorised to use the donation bridge.', '', 403 );
	}

	if ( ! tarteel_donation_boot_cart() ) {
		tarteel_donation_bridge_response( 'error', 'The WooCommerce cart could not be started.', $target_origin, 503 );
	}

	$product_id = isset( $_POST['product_id'] ) ? absint( $_POST['product_id'] ) : 0;
	$product    = $product_id ? wc_get_product( $product_id ) : false;

	if ( ! tarteel_donation_is_approved_product( $product ) ) {
		tarteel_donation_bridge_response( 'error', 'The selected donation product is not approved.', $target_origin, 400 );
	}

	$raw_amount = isset( $_POST['amount'] ) ? wp_unslash( $_POST['amount'] ) : '';
	$amount     = (float) wc_format_decimal( $raw_amount, 2 );

	if ( $amount < TARTEEL_DONATION_MIN_AMOUNT || $amount > TARTEEL_DONATION_MAX_AMOUNT ) {
		tarteel_donation_bridge_response( 'error', 'Choose a valid donation amount between R1 and R100 000.', $target_origin, 400 );
	}

	if ( method_exists( WC()->session, 'set_customer_session_cookie' ) ) {
		WC()->session->set_customer_session_cookie( true );
	}

	$cart_item_data = array(
		'tarteel_donation_amount' => $amount,
		'tarteel_donation_key'    => wp_generate_uuid4(),
	);

	$cart_item_key = WC()->cart->add_to_cart( $product_id, 1, 0, array(), $cart_item_data );
	if ( ! $cart_item_key ) {
		tarteel_donation_bridge_response( 'error', 'The donation could not be added to the cart.', $target_origin, 500 );
	}

	WC()->cart->calculate_totals();
	WC()->cart->set_session();

	if ( method_exists( WC()->session, 'save_data' ) ) {
		WC()->session->save_data();
	}

	$token = wp_generate_password( 32, false, false );
	set_transient(
		'tarteel_donation_confirm_' . $token,
		array(
			'origin'        => $target_origin,
			'cart_item_key' => $cart_item_key,
		),
		TARTEEL_DONATION_CONFIRM_TTL
	);

	$confirm_url = add_query_arg(
		array(
			'action' => 'tarteel_donation_bridge_confirm',
			'token'  => rawurlencode( $token ),
		),
		admin_url( 'admin-post.php' )
	);

	wp_safe_redirect( $confirm_url, 303 );
	exit;
}
add_action( 'admin_post_nopriv_tarteel_donation_bridge', 'tarteel_donation_bridge_handle' );
add_action( 'admin_post_tarteel_donation_bridge', 'tarteel_donation_bridge_handle' );

/**
 * Confirm that the just-created cart item can be read back from the new
 * WooCommerce browser session before reporting success to the opener.
 */
function tarteel_donation_bridge_confirm() {
	$token = isset( $_GET['token'] ) ? sanitize_text_field( wp_unslash( $_GET['token'] ) ) : '';
	$data  = $token ? get_transient( 'tarteel_donation_confirm_' . $token ) : false;

	if ( ! is_array( $data ) || empty( $data['origin'] ) || empty( $data['cart_item_key'] ) ) {
		tarteel_donation_bridge_response( 'error', 'The donation session could not be confirmed. Please try again.', '', 400 );
	}

	delete_transient( 'tarteel_donation_confirm_' . $token );
	$target_origin = tarteel_donation_validate_origin( $data['origin'] );

	if ( '' === $target_origin || ! tarteel_donation_boot_cart() ) {
		tarteel_donation_bridge_response( 'error', 'The WooCommerce cart session could not be confirmed.', $target_origin, 500 );
	}

	$cart         = WC()->cart->get_cart();
	$cart_item_key = (string) $data['cart_item_key'];

	if ( ! isset( $cart[ $cart_item_key ] ) ) {
		tarteel_donation_bridge_response( 'error', 'The donation was not retained in the cart. Please try again.', $target_origin, 409 );
	}

	tarteel_donation_bridge_response( 'success', 'General Donation has been added to your cart.', $target_origin, 200 );
}
add_action( 'admin_post_nopriv_tarteel_donation_bridge_confirm', 'tarteel_donation_bridge_confirm' );
add_action( 'admin_post_tarteel_donation_bridge_confirm', 'tarteel_donation_bridge_confirm' );

function tarteel_donation_apply_cart_price( $cart ) {
	if ( ! $cart instanceof WC_Cart ) {
		return;
	}

	foreach ( $cart->get_cart() as $cart_item ) {
		if ( isset( $cart_item['tarteel_donation_amount'], $cart_item['data'] ) && $cart_item['data'] instanceof WC_Product ) {
			$cart_item['data']->set_price( (float) $cart_item['tarteel_donation_amount'] );
		}
	}
}
add_action( 'woocommerce_before_calculate_totals', 'tarteel_donation_apply_cart_price', 20 );

function tarteel_donation_display_cart_amount( $item_data, $cart_item ) {
	if ( isset( $cart_item['tarteel_donation_amount'] ) ) {
		$item_data[] = array(
			'key'   => 'Donation amount',
			'value' => wc_price( (float) $cart_item['tarteel_donation_amount'] ),
		);
	}
	return $item_data;
}
add_filter( 'woocommerce_get_item_data', 'tarteel_donation_display_cart_amount', 10, 2 );

function tarteel_donation_save_order_amount( $item, $cart_item_key, $values, $order ) {
	if ( isset( $values['tarteel_donation_amount'] ) ) {
		$item->add_meta_data( 'Donation amount', wc_format_decimal( $values['tarteel_donation_amount'], 2 ), true );
	}
}
add_action( 'woocommerce_checkout_create_order_line_item', 'tarteel_donation_save_order_amount', 10, 4 );
