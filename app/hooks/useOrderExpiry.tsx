import { createContext, useContext, useState, ReactNode } from 'react';

interface OrderExpiryContextType {
  isOrderExpired: boolean;
  expiryDetails: {
    eventId?: string;
    eventName?: string;
  } | null;
  setOrderExpired: (details: { eventId?: string; eventName?: string }) => void;
  clearExpiry: () => void;
}

const OrderExpiryContext = createContext<OrderExpiryContextType | undefined>(undefined);

export const useOrderExpiry = () => {
  const context = useContext(OrderExpiryContext);
  if (context === undefined) {
    throw new Error('useOrderExpiry must be used within an OrderExpiryProvider');
  }
  return context;
};

export const OrderExpiryProvider = ({ children }: { children: ReactNode }) => {
  const [isOrderExpired, setIsOrderExpired] = useState(false);
  const [expiryDetails, setExpiryDetails] = useState<{
    eventId?: string;
    eventName?: string;
  } | null>(null);

  const setOrderExpired = (details: { eventId?: string; eventName?: string }) => {
    setExpiryDetails(details);
    setIsOrderExpired(true);
  };

  const clearExpiry = () => {
    setIsOrderExpired(false);
    setExpiryDetails(null);
  };

  return (
    <OrderExpiryContext.Provider
      value={{
        isOrderExpired,
        expiryDetails,
        setOrderExpired,
        clearExpiry,
      }}
    >
      {children}
    </OrderExpiryContext.Provider>
  );
};
