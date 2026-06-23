export interface TaskConfig {
  id: 'payment-reward' | 'paymongo-archive' | 'paymongo-reconcile' | 'paypal-cancel' | 'paypal-reconcile' | 'auto-expire' | 'crypto-verify';
  label: string;
  schtasksName: string;
}

export const TASKS: TaskConfig[] = [
  {
    id: 'payment-reward',
    label: 'Payment Reward Recovery',
    schtasksName: 'TaleOfAsia\\PaymentReward',
  },
  {
    id: 'paymongo-archive',
    label: 'PayMongo Archive',
    schtasksName: 'TaleOfAsia\\PaymongoArchive',
  },
  {
    id: 'paymongo-reconcile',
    label: 'PayMongo Reconcile',
    schtasksName: 'TaleOfAsia\\PaymongoReconcile',
  },
  {
    id: 'paypal-cancel',
    label: 'PayPal Cancel',
    schtasksName: 'TaleOfAsia\\PaypalCancel',
  },
  {
    id: 'paypal-reconcile',
    label: 'PayPal Reconcile',
    schtasksName: 'TaleOfAsia\\PaypalReconcile',
  },
  {
    id: 'auto-expire',
    label: 'Auto-Expire Pending Payments',
    schtasksName: 'TaleOfAsia\\AutoExpirePayments',
  },
  {
    id: 'crypto-verify',
    label: 'Crypto Verify',
    schtasksName: 'TaleOfAsia\\CryptoVerify',
  },
];
