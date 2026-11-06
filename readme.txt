=== NimbusPal ===
Contributors: nimbuspal
Tags: chat, customer support, live chat, chatbot, woocommerce
Requires at least: 6.3
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 0.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

A friendly customer support helper for your website. Connects to the external NimbusPal service.

== Description ==

NimbusPal adds a customizable helper to your website that can answer visitors' questions and pass conversations to your team.

**This plugin connects to an external service.** It does not work without a NimbusPal account. See "External services" below for what is sent and when.

What the plugin does:

* Adds the helper to every page, or only to pages where you place the `[nimbuspal]` shortcode.
* Bundles the helper's files locally. It does not load scripts from a CDN.
* If WooCommerce is active, provides read-only order lookup, tracking and product search that only the NimbusPal service can call.

The plugin never changes your store's data. It cannot issue refunds or edit orders.

= Free and paid =

The plugin is free and the same for everyone, with no locked code. Plans are managed by the NimbusPal service, not in this plugin.

* **Free plan:** menu-button helper with no AI, live chat with 1 agent, and a "Powered by NimbusPal" label in the helper.
* **Paid plans:** AI answers, knowledge base, WooCommerce order features, more agents and full customization, including removing the label on the top plan. Details and current prices are on the NimbusPal website.

The "Powered by NimbusPal" label is plain text inside the helper. It is shown according to your NimbusPal plan.

== External services ==

This plugin relies on the NimbusPal service, operated by NimbusPal, to provide the helper. Nothing is sent until you enter an API key and connect.

* **When you connect:** your site address, the address of this plugin's REST endpoint, the plugin version, whether WooCommerce is active, and your API key.
* **When a visitor's page loads (once connected):** the visitor's browser requests the helper's settings from NimbusPal. Like any web request, this includes the visitor's IP address and the page's origin.
* **When a visitor uses the helper:** the messages they type are sent to and stored by NimbusPal. On plans with AI answers, messages are also processed by NimbusPal's AI provider to generate a reply. The helper keeps the chat in the visitor's browser session storage for that tab.
* **When a customer asks about an order (WooCommerce and an eligible plan only):** NimbusPal sends this site the order number and email the customer gave. If they match, this site returns the order number, status, date, total, currency, item names and quantities. Addresses, phone numbers and payment details are not returned.
* **When a customer asks about tracking (WooCommerce and an eligible plan only):** the same order number and email check applies. If they match, this site returns the order's status and any shipment provider, tracking number, tracking link and date stored on the order.
* **When a customer asks about products (WooCommerce and an eligible plan only):** NimbusPal sends this site the search words. This site returns the name, price, stock status and link of matching published products.

Service terms: https://nimbuspal.com/terms
Privacy policy: https://nimbuspal.com/privacy

== Installation ==

1. Install and activate the plugin.
2. Go to Settings > NimbusPal.
3. Paste your API key from your NimbusPal account and save.
4. Choose where the helper should appear.

== Frequently Asked Questions ==

= Do I need WooCommerce? =

No. WooCommerce is only needed for order lookup, tracking and product search. Those endpoints do not exist on sites without it.

= Can the helper issue refunds? =

No. The plugin's store access is read-only.

= Is the API key stored on my site? =

No. It is used once to connect and then discarded. This site stores a public site key and a hash of a token used to check requests from NimbusPal.

= Where is the source code for the bundled script? =

The helper's script at `assets/widget/nimbuspal-widget.js` is a built file. Its human-readable source is included in this plugin in `widget-src/`. To rebuild it, run `npm install` and `npm run build` in that folder.

== Changelog ==

= 0.1.0 =
* First version: settings page, helper on every page or by shortcode, and read-only WooCommerce order lookup.
