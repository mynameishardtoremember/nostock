console.log("detect enabled");

(function() {
let inStock = false;
let detectTarget;

switch (window.location.hostname) {
case "www.amazon.com":
  // this also works for preorders
  detectTarget = document.getElementById("add-to-cart-button");
  console.log(detectTarget);
  inStock = detectTarget !== null;
  break;

case "www.amd.com":
  detectTarget = document.getElementsByClassName("btn-shopping-cart");
  console.log(detectTarget);
  if (detectTarget.length > 0) {
    inStock = detectTarget[0].tagName === "BUTTON";
  }
  break;

case "www.bestbuy.com":
  detectTarget = document.getElementsByClassName(
      "btn btn-lg btn-block add-to-cart-button");
  console.log(detectTarget);
  if (detectTarget.length > 0) {
    let state = detectTarget[0].innerText.toLowerCase();
    if (state.includes("pre-order") || state.includes("add to cart")) {
      inStock = true;
    }
  }
  break;

case "www.bhphotovideo.com":
  for (let b of document.getElementsByTagName("button")) {
    // console.log(b);
    // todo: find the attribute for preorders
    btn = b.getAttribute("data-selenium");
    if (btn == "addToCartButton") {
      console.log(btn);
      inStock = true;
      break;
    }
  }
  break;

case "www.newegg.com":
  detectTarget = document.getElementById("ProductBuy");
  console.log(detectTarget);
  if (detectTarget != null) {
    let state = detectTarget.innerText.toLowerCase();
    inStock = state.includes("add to cart") ||
              state.includes("special order") || state.includes("pre-order");
  }
  break;

case "www.walmart.com":
  detectTarget = document.getElementsByClassName(
      "prod-ShippingOffer prod-PositionedRelative Grid prod-PriceHero prod-PriceHero-buy-box-update prod-ProductOffer-enhanced");
  console.log(detectTarget);
  if (detectTarget.length > 0) {
    let state = detectTarget[0].innerText.toLowerCase();
    let detectTargetButton = document.getElementsByClassName(
        "button spin-button prod-ProductCTA--primary button--primary")
    let stateButton = detectTargetButton[0].innerText.toLowerCase();
    inStock = !(state.includes("out of stock")) || state.includes("preorder") ||
              stateButton.includes("add to cart") ||
              stateButton.includes("preorder") ||
              !(stateButton.includes("get in-stock alert"));
  }
  break;
}

console.log("instock", inStock);
chrome.runtime.sendMessage(AUTOREFRESH_EXT_ID, {"instock" : inStock},
                           function(response) {});
})();
