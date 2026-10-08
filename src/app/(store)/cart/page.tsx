import { CartContents } from "@/modules/cart/client";
export const metadata = {
  title: "Your cart",
  robots: { index: false, follow: false },
};
export default function CartPage() {
  return (
    <section className="sf-cart-page">
      <h1>Your cart</h1>
      <p>Review your selections. Prices and availability are checked live.</p>
      <CartContents />
    </section>
  );
}
