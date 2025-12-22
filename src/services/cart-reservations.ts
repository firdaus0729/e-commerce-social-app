import { Cart } from '../models/Cart';
import { Product } from '../models/Product';

/**
 * Release cart item reservations older than the given expiry (default 1 hour).
 * This will return reserved stock back to products and remove expired items from carts.
 */
export async function releaseExpiredReservations(expiryMs: number = 1000 * 60 * 60) {
  const cutoff = new Date(Date.now() - expiryMs);
  const carts = await Cart.find({ 'items.reservedAt': { $lt: cutoff } });
  if (!carts || carts.length === 0) return;

  for (const cart of carts) {
    let changed = false;
    const remainingItems: any[] = [];
    for (const item of cart.items) {
      if (item.reservedAt && item.reservedAt < cutoff) {
        try {
          await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
          changed = true;
        } catch (err) {
          console.error('Failed to return stock for product', item.product, err);
        }
      } else {
        remainingItems.push(item);
      }
    }
    if (changed) {
      cart.items = remainingItems;
      await cart.save();
      console.log(`Released expired reservations for cart ${cart._id}`);
    }
  }
}

export default releaseExpiredReservations;
