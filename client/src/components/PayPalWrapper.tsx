import React, { useState } from 'react';
import { PayPalButtons, PayPalScriptProvider, usePayPalScriptReducer } from "@paypal/react-paypal-js";
import { AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PayPalWrapperProps {
  clientId: string;
  total: number;
  onCreateOrder: () => Promise<string>;
  onApprove: (orderId: string) => Promise<void>;
  onError?: (error: any) => void;
  onCancel?: () => void;
}

function PayPalButtonsWrapper({ 
  total, 
  onCreateOrder, 
  onApprove, 
  onError, 
  onCancel 
}: Omit<PayPalWrapperProps, 'clientId'>) {
  const [{ isPending, isResolved, isRejected }] = usePayPalScriptReducer();
  const { toast } = useToast();

  console.log("PayPalScriptReducer State:", { isPending, isResolved, isRejected });
  console.log("Browser Environment:", {
    windowPaypal: typeof window !== 'undefined' && window.paypal,
    navigatorUserAgent: typeof navigator !== 'undefined' && navigator.userAgent,
  });

  const isPayPalReady = isResolved && typeof window !== 'undefined' && window.paypal && window.paypal.Buttons;

  if (isRejected) {
    return (
      <div className="p-4 border border-red-300 bg-red-50 rounded-md">
        <div className="flex items-center">
          <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
          <p className="text-sm text-red-800">
            Failed to load PayPal SDK. Please try refreshing the page or select another payment method.
          </p>
        </div>
      </div>
    );
  }

  if (!isPayPalReady) {
    return (
      <div className="p-4 border border-gray-300 bg-gray-50 rounded-md">
        <p className="text-sm text-gray-600">{isPending ? "Loading PayPal..." : "PayPal SDK not ready."}</p>
      </div>
    );
  }

  return (
    <div className="paypal-button-container">
      <PayPalButtons
        fundingSource="paypal"
        style={{
          layout: "vertical",
          color: "gold",
          shape: "rect",
          label: "paypal",
          height: 40
        }}
        createOrder={async () => {
          try {
            const orderId = await onCreateOrder();
            console.log("PayPal Order Created:", orderId);
            return orderId;
          } catch (error: any) {
            console.error("PayPal Create Order Error:", error);
            toast({
              title: "PayPal Error",
              description: error.message || "Failed to create PayPal order",
              variant: "destructive",
            });
            throw error;
          }
        }}
        onApprove={async (data) => {
          try {
            console.log("PayPal Approve Data:", data);
            await onApprove(data.orderID);
          } catch (error: any) {
            console.error("PayPal Approve Error:", error);
            toast({
              title: "PayPal Error", 
              description: error.message || "Failed to process PayPal payment",
              variant: "destructive",
            });
            if (onError) onError(error);
          }
        }}
        onError={(error) => {
          console.error("PayPal Button Error:", error);
          toast({
            title: "PayPal Error",
            description: "PayPal payment failed. Please try again or select another payment method.",
            variant: "destructive",
          });
          if (onError) onError(error);
        }}
        onCancel={() => {
          console.log("PayPal Payment Cancelled");
          toast({
            title: "Payment Cancelled",
            description: "PayPal payment was cancelled.",
          });
          if (onCancel) onCancel();
        }}
      />
    </div>
  );
}

export default function PayPalWrapper({ 
  clientId, 
  total, 
  onCreateOrder, 
  onApprove, 
  onError, 
  onCancel 
}: PayPalWrapperProps) {
  const [scriptError, setScriptError] = useState<string | null>(null);

  if (typeof window === 'undefined') {
    return null; // Prevent SSR issues
  }

  return (
    <PayPalScriptProvider
      options={{
        "client-id": clientId,
        currency: "USD",
        intent: "capture",
        components: "buttons",
        vault: false
      }}
      deferLoading={false}
      onError={(error) => {
        console.error("PayPalScriptProvider Error:", error);
        setScriptError("Failed to load PayPal SDK. Please try again.");
      }}
    >
      {console.log("PayPal SDK Status:", { 
        isWindowDefined: typeof window !== 'undefined', 
        windowPaypal: typeof window !== 'undefined' && window.paypal, 
        clientId 
      })}
      {scriptError ? (
        <div className="p-4 border border-red-300 bg-red-50 rounded-md">
          <div className="flex items-center">
            <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
            <p className="text-sm text-red-800">{scriptError}</p>
          </div>
        </div>
      ) : (
        <PayPalButtonsWrapper
          total={total}
          onCreateOrder={onCreateOrder}
          onApprove={onApprove}
          onError={onError}
          onCancel={onCancel}
        />
      )}
    </PayPalScriptProvider>
  );
}
