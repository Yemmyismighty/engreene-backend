// Repository exports
export { BaseRepository } from './BaseRepository';
export { WalletRepository } from './WalletRepository';
export { EscrowRepository } from './EscrowRepository';
export { CartRepository } from './CartRepository';
export { WishlistRepository } from './WishlistRepository';
export { NotificationRepository } from './NotificationRepository';
export { MessageRepository } from './MessageRepository';
export { VendorAutoResponseRepository } from './VendorAutoResponseRepository';
export { UserOnlineStatusRepository } from './UserOnlineStatusRepository';

// Create repository instances for easy import
import { WalletRepository } from './WalletRepository';
import { EscrowRepository } from './EscrowRepository';
import { CartRepository } from './CartRepository';
import { WishlistRepository } from './WishlistRepository';
import { NotificationRepository } from './NotificationRepository';
import { MessageRepository } from './MessageRepository';
import { VendorAutoResponseRepository } from './VendorAutoResponseRepository';
import { UserOnlineStatusRepository } from './UserOnlineStatusRepository';

export const walletRepository = new WalletRepository();
export const escrowRepository = new EscrowRepository();
export const cartRepository = new CartRepository();
export const wishlistRepository = new WishlistRepository();
export const notificationRepository = new NotificationRepository();
export const messageRepository = new MessageRepository();
export const vendorAutoResponseRepository = new VendorAutoResponseRepository();
export const userOnlineStatusRepository = new UserOnlineStatusRepository();