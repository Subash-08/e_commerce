import type { CollectionIndexes } from "../../server/db/indexes";
export const paymentBindingIndexes: readonly CollectionIndexes[] = [
  {
    collection: "paymentBindings",
    indexes: [
      {
        name: "binding_operation_unique",
        key: { operationId: 1 },
        unique: true,
      },
      {
        name: "binding_generation_unique",
        key: { orderId: 1, generation: 1 },
        unique: true,
      },
      {
        name: "binding_active_order_unique",
        key: { orderId: 1 },
        unique: true,
        partialFilterExpression: { active: true },
      },
      {
        name: "binding_provider_order_unique",
        key: { provider: 1, mode: 1, accountKeyHash: 1, providerOrderId: 1 },
        unique: true,
        partialFilterExpression: { providerOrderId: { $type: "string" } },
      },
    ],
  },
  {
    collection: "payments",
    indexes: [
      {
        name: "payment_provider_identity_unique",
        key: { provider: 1, mode: 1, accountKeyHash: 1, providerPaymentId: 1 },
        unique: true,
      },
      { name: "payments_order_created", key: { orderId: 1, createdAt: -1 } },
    ],
  },
  {
    collection: "webhookEvents",
    indexes: [
      {
        name: "webhook_delivery_unique",
        key: { provider: 1, mode: 1, accountKeyHash: 1, deliveryKey: 1 },
        unique: true,
      },
      { name: "webhook_state_received", key: { state: 1, receivedAt: 1 } },
    ],
  },
];
