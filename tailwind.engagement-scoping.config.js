/**
 * Tailwind v3 build for /engagement-scoping.
 *
 * The page used to pull the Play CDN (cdn.tailwindcss.com), which is a JIT runtime
 * that generates utilities in the browser. The site CSP does not allow that origin,
 * so the page shipped unstyled. There is also no prebuilt Tailwind CSS on any
 * allow-listed CDN: cdnjs stops at v2.2.19, which predates the `stone` palette this
 * page uses 107 times, and no static build can ever contain arbitrary-value classes
 * like `border-[#169B62]`.
 *
 * Compiling here fixes both: the CLI scans the sources below and emits exactly the
 * utilities they use — including the arbitrary values — into a file served from
 * 'self', which style-src already allows. No CSP change needed.
 *
 * `content` MUST list the .jsx source: the markup moved out of index.html when the
 * app was extracted, so scanning only the HTML would silently emit a near-empty
 * stylesheet and the page would render unstyled with a green build.
 */
export default {
  content: [
    './donovan-legal-site/src/engagement-scoping.jsx',
    './donovan-legal-site/engagement-scoping/index.html',
  ],
  theme: { extend: {} },
  plugins: [],
};
