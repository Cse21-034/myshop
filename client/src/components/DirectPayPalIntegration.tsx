 import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle } from "lucide-react";

// Define PayPal window interface for type safety
interface PayPalWindow extends Window {
  paypal: {
    Buttons?: (config: {
      style?: {
        layout?: 'vertical' | 'horizontal';
        color?: 'gold' | 'blue' | 'silver' | 'white' | 'black';
        shape?: 'rect' | 'pill';
        label?: 'paypal' | 'checkout' | 'buynow' | 'pay';
        height?: number;
      };
      createOrder?: (data: any, actions: any) => Promise<string>;
      onApprove?: (data: any, actions: any) => Promise<void>;
      onError?: (error: any) => void;
      onCancel?: () => void;
    }) => { render: (container: string | HTMLElement) => void };
  };
}

declare const window: PayPalWindow;

interface DirectPayPalIntegrationProps {
  clientId: string;
  total: number;
  onCreateOrder: () => Promise<string>;
  onApprove: (orderId: string) => Promise<void>;
  onError?: (error: any) => void;
  onCancel?: () => void;
}

export default function DirectPayPalIntegration({
  clientId,
  total,
  onCreateOrder,
  onApprove,
  onError,
  onCancel
}: DirectPayPalIntegrationProps) {
  const paypalRef = useRef<HTMLDivElement>(null);
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  // Debug PayPal SDK availability
  const checkPayPalSDK = () => {
    console.log('Checking PayPal SDK:', {
      windowPaypalExists: !!window.paypal,
      buttonsExists: !!window.paypal?.Buttons,
      sdkLoaded: isSDKLoaded,
      retryCount,
      clientId,
    });
  };

  // Load PayPal SDK
  useEffect(() => {
    if (window.paypal && window.paypal.Buttons) {
      console.log("PayPal SDK already loaded");
      setIsSDKLoaded(true);
      setIsLoading(false);
      return;
    }

    const script = document.createElement('script');
    // Simplified URL to rule out issues with query parameters
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
    script.async = true;

    script.onload = () => {
      console.log('PayPal SDK loaded successfully');
      if (window.paypal?.Buttons) {
        setIsSDKLoaded(true);
        setIsLoading(false);
        setSdkError(null);
      } else {
        console.warn('PayPal SDK loaded but Buttons component missing');
        setRetryCount(prev => prev + 1);
      }
    };

    script.onerror = (error) => {
      console.error('Failed to load PayPal SDK:', error);
      setSdkError('Failed to load PayPal SDK. Please check your internet connection or PayPal Client ID.');
      setIsLoading(false);
    };

    document.head.appendChild(script);

    // Timeout for SDK loading
    const timeout = setTimeout(() => {
      if (!window.paypal || !window.paypal.Buttons) {
        setSdkError('PayPal SDK failed to load after timeout. Please try another payment method.');
        setIsLoading(false);
      }
    }, 10000); // 10-second timeout

    return () => {
      clearTimeout(timeout);
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [clientId, retryCount]);

  // Retry loading SDK if Buttons component is missing
  useEffect(() => {
    if (retryCount > 0 && retryCount <= 3 && !window.paypal?.Buttons) {
      console.log(`Retrying PayPal SDK load (attempt ${retryCount}/3)`);
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
      script.async = true;

      script.onload = () => {
        console.log('PayPal SDK retry loaded successfully');
        if (window.paypal?.Buttons) {
          setIsSDKLoaded(true);
          setIsLoading(false);
          setSdkError(null);
        } else {
          setRetryCount(prev => prev + 1);
        }
      };

      script.onerror = () => {
        console.error('PayPal SDK retry failed');
        setSdkError('Failed to load PayPal SDK after retries. Please try another payment method.');
        setIsLoading(false);
      };

      document.head.appendChild(script);

      return () => {
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
      };
    }
  }, [retryCount, clientId]);

  // Render PayPal buttons
  useEffect(() => {
    if (!isSDKLoaded || !paypalRef.current || !window.paypal || !window.paypal.Buttons) {
      console.warn('PayPal SDK not ready:', { isSDKLoaded, paypalExists: !!window.paypal, buttonsExists: !!window.paypal?.Buttons });
      return;
    }

    paypalRef.current.innerHTML = ''; // Clear existing buttons

    try {
      window.paypal.Buttons({
        style: {
          layout: 'vertical',
          color: 'gold',
          shape: 'rect',
          label: 'paypal',
          height: 40
        },
        createOrder: async (data, actions) => {
          try {
            console.log('Creating PayPal order for amount:', total);
            const orderId = await onCreateOrder();
            console.log('PayPal order created:', orderId);
            return orderId;
          } catch (error: any) {
            console.error('PayPal Create Order Error:', error);
            setSdkError(error.message || 'Failed to create PayPal order');
            if (onError) onError(error);
            throw error;
          }
        },
        onApprove: async (data: any) => {
          try {
            console.log('PayPal order approved:', data);
            setSdkError(null);
            await onApprove(data.orderID);
          } catch (error: any) {
            console.error('PayPal Approve Error:', error);
            setSdkError(error.message || 'Failed to process PayPal payment');
            if (onError) onError(error);
          }
        },
        onError: (error: any) => {
          console.error('PayPal Button Error:', error);
          setSdkError('PayPal payment failed. Please try again or select another payment method.');
          if (onError) onError(error);
        },
        onCancel: () => {
          console.log('PayPal Payment Cancelled');
          setSdkError(null);
          if (onCancel) onCancel();
        }
      }).render(paypalRef.current);

      console.log('PayPal buttons rendered successfully');
    } catch (error: any) {
      console.error('Error rendering PayPal buttons:', error);
      setSdkError('Failed to initialize PayPal buttons. Please try another payment method or refresh the page.');
      if (onError) onError(error);
    }
  }, [isSDKLoaded, total, onCreateOrder, onApprove, onError, onCancel]);

  // Debug SDK status periodically
  useEffect(() => {
    checkPayPalSDK();
    const interval = setInterval(checkPayPalSDK, 1000); // Check every second
    return () => clearInterval(interval);
  }, [isSDKLoaded, retryCount]);

  if (isLoading) {
    return (
      <div className="p-4 border border-gray-300 bg-gray-50 rounded-md">
        <p className="text-sm text-gray-600">Loading PayPal...</p>
      </div>
    );
  }

  if (sdkError) {
    return (
      <div className="p-4 border border-red-300 bg-red-50 rounded-md">
        <div className="flex items-center">
          <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
          <p className="text-sm text-red-800">
            {sdkError} Please try another payment method or refresh the page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="paypal-container">
      <div ref={paypalRef} id="paypal-button-container"></div>
    </div>
  );
}
