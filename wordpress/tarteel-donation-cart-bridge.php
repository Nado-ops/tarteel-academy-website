<?php
/**
 * Plugin Name: Tarteel Donation Cart Bridge
 * Description: Adds the approved General Donation product to the WooCommerce cart from the Tarteel Academy modal.
 * Version: 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const TARTEEL_DONATION_MIN_AMOUNT = 1.00;
const TARTEEL_DONATION_MAX_AMOUNT = 100000.00;

/**
 * Return the approved Tarteel origins that may open the bridge popup.
 * Add the final production domain here when DNS is connected.
 *
 * @return string[]
 */
function tarteel_donation_allowed_origins() {
	return array(
		'https://super-firefly-660f.itnanotech1.workers.dev',
	);
}

/**
 * Validate and normalize the opener origin.
 *
 * @param string $origin Raw origin.
 * @return string
 */
function tarteel_donation_validate_origin( $origin ) {
	$origin = untrailingslashit( esc_url_raw( $origin ) );
	return in_array( $origin, tarteel_donation_allowed_origins(), true ) ? $origin : '';
}

/**
 * Confirm that the submitted product is the approved General Donation item.
 * This avoids relying on a hard-coded ID that may differ between environments.
 *
 * @param WC_Product $product Product object.
 * @return bool
 */
function tarteel_donation_is_approved_product( $product ) {
	if ( ! $product instanceof WC_Product ) {
		return false;
	}

	$slug = strtolower( (string) $product->get_slug() );
	$name = strtolower( trim( wp_strip_all_tags( (string) $product->get_name() ) ) );

	return 'donte' === $slug || 'general donation' === $name;
}

/**
 * Render the small popup response page and securely notify the opener.
 *
 * @param string $status        success|error.
 * @param string $message       Human-readable result.
 * @param string $target_origin Validated Tarteel origin.
 * @param int    $http_status   HTTP status code.
 * @return void
 */
function tarteel_donation_bridge_response( $status, $message, $target_origin, $http_status = 200 ) {
	$status  = 'success' === $status ? 'success' : 'error';
	$payload = wp_json_encode(
		array(
			'source'  => 'tarteel-donation-bridge',
			'status'  => $status,
			'message' => $message,
		)
	);
	$origin  = wp_json_encode( $target_origin );
	$nonce   = wp_generate_password( 24, false, false );

	status_header( $http_status );
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
			window.setTimeout(function () { window.close(); }, 350);
		}());
		</script>
	</body>
	</html>
	<?php
	exit;
}

/**
 * Handle the cross-site top-level POST from the Tarteel modal.
 *
 * @return void
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

	if ( ! function_exists( 'WC' ) || ! class_exists( 'WooCommerce' ) ) {
		tarteel_donation_bridge_response( 'error', 'WooCommerce is unavailable.', $target_origin, 503 );
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

	if ( function_exists( 'wc_load_cart' ) && ( null === WC()->session || null === WC()->cart ) ) {
		wc_load_cart();
	}

	if ( ! WC()->session || ! WC()->cart ) {
		tarteel_donation_bridge_response( 'error', 'The WooCommerce cart could not be started.', $target_origin, 500 );
	}

	$cart_item_data = array(
		'tarteel_donation_amount' => $amount,
		'tarteel_donation_key'    => wp_generate_uuid4(),
	);

	$cart_item_key = WC()->cart->add_to_cart( $product_id, 1, 0, array(), $cart_item_data );
	if ( ! $cart_item_key ) {
		tarteel_donation_bridge_response( 'error', 'The donation could not be added to the cart.', $target_origin, 500 );
	}

	if ( method_exists( WC()->session, 'set_customer_session_cookie' ) ) {
		WC()->session->set_customer_session_cookie( true );
	}
	WC()->cart->set_session();

	tarteel_donation_bridge_response( 'success', 'General Donation has been added to your cart.', $target_origin, 200 );
}
add_action( 'admin_post_nopriv_tarteel_donation_bridge', 'tarteel_donation_bridge_handle' );
add_action( 'admin_post_tarteel_donation_bridge', 'tarteel_donation_bridge_handle' );

/**
 * Apply the selected donation amount to the cart line.
 *
 * @param WC_Cart $cart Cart object.
 * @return void
 */
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

/**
 * Display the selected donation amount in the cart and checkout.
 *
 * @param array $item_data Existing item data.
 * @param array $cart_item Cart item.
 * @return array
 */
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

/**
 * Save the selected amount to the order line item.
 *
 * @param WC_Order_Item_Product $item          Order item.
 * @param string                $cart_item_key Cart item key.
 * @param array                 $values        Cart item data.
 * @param WC_Order              $order         Order object.
 * @return void
 */
function tarteel_donation_save_order_amount( $item, $cart_item_key, $values, $order ) {
	if ( isset( $values['tarteel_donation_amount'] ) ) {
		$item->add_meta_data( 'Donation amount', wc_price( (float) $values['tarteel_donation_amount'] ), true );
	}
}
add_action( 'woocommerce_checkout_create_order_line_item', 'tarteel_donation_save_order_amount', 10, 4 );
