import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function Terms() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl font-bold text-primary mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: 7 July 2026</p>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">1. Acceptance of Terms</h2>
            <p>
              By creating an account or placing an order on Fountstream ("the Platform"), you agree to be
              bound by these Terms of Service and our Privacy Policy. If you do not agree, please do not
              use the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">2. Use of the Platform</h2>
            <p>
              You must be at least 18 years old to use Fountstream. You agree to provide accurate,
              current, and complete information during registration. You are responsible for maintaining
              the confidentiality of your account credentials.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">3. Orders and Payments</h2>
            <p>
              All prices are displayed in Botswana Pula (BWP). By placing an order you make an offer to
              purchase the selected items. Fountstream reserves the right to cancel or refuse any order
              at its discretion. Payment must be completed before goods are dispatched (except for
              Cash on Delivery orders).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">4. Card Payments via PayGate</h2>
            <p>
              Card payments are processed securely by PayGate (Pty) Ltd, a PCI-DSS compliant payment
              gateway. Fountstream never stores your card details. By choosing card payment you agree to
              PayGate's terms and conditions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">5. Delivery and Returns</h2>
            <p>
              Delivery is available within Botswana only. Estimated delivery times are provided at
              checkout but are not guaranteed. Returns are accepted within 30 days of delivery for
              unused items in original packaging. Perishable and farm products are non-refundable once
              collected.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">6. Seller Obligations</h2>
            <p>
              Sellers on Fountstream are independent merchants. Each seller is responsible for the
              accuracy of their listings, fulfilment of orders, and compliance with applicable
              Botswana law. Fountstream acts as a marketplace facilitator only.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">7. Prohibited Conduct</h2>
            <p>
              You may not use Fountstream to: (a) post false or misleading listings; (b) infringe any
              third-party intellectual property rights; (c) transmit spam or malicious code; (d) engage
              in fraudulent transactions; or (e) violate any applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">8. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Fountstream shall not be liable for any indirect,
              incidental, or consequential damages arising from your use of the Platform or any
              transactions conducted through it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">9. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. Continued use of Fountstream after changes
              are posted constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">10. Contact Us</h2>
            <p>
              For questions about these Terms, email us at{" "}
              <a href="mailto:support@fountstream.com" className="text-primary underline">
                support@fountstream.com
              </a>
              .
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
