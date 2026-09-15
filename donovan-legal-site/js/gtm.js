// Google Tag Manager bootstrap. The edge middleware adds this module to every
// HTML document only when the ANALYTICS deployment flag is on.
const containerId = 'GTM-W9DH8BN6';
const dataLayerName = 'dataLayer';
const dataLayer = window[dataLayerName] = window[dataLayerName] || [];

dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });

const firstScript = document.getElementsByTagName('script')[0];
const gtmScript = document.createElement('script');
const layerQuery = dataLayerName === 'dataLayer' ? '' : `&l=${dataLayerName}`;

gtmScript.async = true;
gtmScript.src = `https://www.googletagmanager.com/gtm.js?id=${containerId}${layerQuery}`;
firstScript.parentNode.insertBefore(gtmScript, firstScript);