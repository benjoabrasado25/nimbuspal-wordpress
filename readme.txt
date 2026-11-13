=== NimbusPal ===
Contributors: benjoabrasado25
Tags: chat, customer support, live chat, chatbot, woocommerce
Requires at least: 6.3
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 0.2.7
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

This plugin relies on the NimbusPal service, operated by NimbusPal, to provide the helper. Nothing is sent until you choose to connect.

* **When you connect:** clicking Connect takes you to the NimbusPal website with your site address, site name and a return address. After you approve, this site sends NimbusPal the address of this plugin's REST endpoint, the plugin version, whether WooCommerce is active, and a one-time code (or your API key, if you use that option).
* **When a visitor starts a chat (once connected):** the visitor's browser asks NimbusPal for a small puzzle and solves it, which helps stop automated abuse. No third-party script is loaded and no cookies are set.
* **When a visitor's page loads (once connected):** the visitor's browser requests the helper's settings from NimbusPal. Like any web request, this includes the visitor's IP address and the page's origin.
* **When a visitor uses the helper:** the messages they type are sent to and stored by NimbusPal. On plans with AI answers, messages are also processed by NimbusPal's AI provider to generate a reply. The helper keeps the chat in the visitor's browser session storage for that tab.
* **When the business uses its own helper picture (top plan only):** visitors' browsers load that picture from NimbusPal's file storage, which is hosted by Supabase (supabase.co). Like any image request, this includes the visitor's IP address. Supabase terms: https://supabase.com/terms and privacy policy: https://supabase.com/privacy
* **When the site owner starts "Learn from my website" (paid plans only):** this only happens after the owner clicks it in their NimbusPal dashboard, which opens this site with a one-time code. The owner's own browser then opens this site's public pages and sends each page's address, title and visible text to NimbusPal, so the helper can answer from them. Pages for carts, checkouts, accounts and logins are skipped. Visitors' browsers never do this.
* **When a customer asks about an order (WooCommerce and an eligible plan only):** NimbusPal sends this site the order number and email the customer gave. If they match, this site returns the order number, status, date, total, currency, item names and quantities. Addresses, phone numbers and payment details are not returned.
* **When a customer asks about tracking (WooCommerce and an eligible plan only):** the same order number and email check applies. If they match, this site returns the order's status and any shipment provider, tracking number, tracking link and date stored on the order.
* **When a customer asks about products (WooCommerce and an eligible plan only):** NimbusPal sends this site the search words. This site returns the name, price, stock status and link of matching published products.

Service terms: https://nimbuspal.com/terms
Privacy policy: https://nimbuspal.com/privacy

== Installation ==

1. Install and activate the plugin.
2. Click NimbusPal in your WordPress admin menu.
3. Click Connect to NimbusPal, sign in or create a free account, and approve your site. You come straight back, connected.
4. Choose where the helper should appear.

== Frequently Asked Questions ==

= Do I need WooCommerce? =

No. WooCommerce is only needed for order lookup, tracking and product search. Those endpoints do not exist on sites without it.

= Can the helper issue refunds? =

No. The plugin's store access is read-only.

= Do I need an API key? =

No. One click is enough. An API key is available under Advanced for those who prefer it, and is never stored. This site stores a public site key and a hash of a token used to check requests from NimbusPal.

= Where is the source code for the bundled script? =

The helper's script at `assets/widget/nimbuspal-widget.js` is a built file. Its human-readable source is included in this plugin in `widget-src/`. To rebuild it, run `npm install` and `npm run build` in that folder.

== Changelog ==

= 0.2.7 =
* Connect to NimbusPal now opens in a new tab when WordPress runs inside a frame, such as WordPress Playground.

= 0.2.6 =
* The NimbusPal menu item now sits at the end of the admin menu, below WordPress's own items.

= 0.2.5 =
* Learn from my website also starts when your website is already open in that tab.

= 0.2.4 =
* Learn from my website: NimbusPal can read your site's pages and answer from them, started from your NimbusPal dashboard.

= 0.2.3 =
* The chat can show your own helper picture, such as your logo, when you upload one in your NimbusPal dashboard (Pro plan).

= 0.2.2 =
* A visitor's message now shows the moment they send it, with the time and whether it was sent.

= 0.2.1 =
* The chat now solves a small invisible puzzle before opening, to help stop automated abuse.

= 0.2.0 =
* One-click connect: no API key to copy. Clickable email addresses and links in chats. Choice of helper characters.

= 0.1.2 =
* NimbusPal now has its own item, with a cloud icon, in the main admin menu.

= 0.1.1 =
* The chat button now stands out on any website. Added read-only tracking and product search, live replies from your team, and a form for leaving an email when the team is away.

= 0.1.0 =
* First version: settings page, helper on every page or by shortcode, and read-only WooCommerce order lookup.
