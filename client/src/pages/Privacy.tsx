import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl font-bold text-primary mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: 7 July 2026</p>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">1. Information We Collect</h2>
            <p>We collect the following information when you use Fountstream:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Account data:</strong> name, email address, and password (stored as a secure hash).</li>
              <li><strong>Order data:</strong> delivery address, phone number, and order history.</li>
              <li><strong>Payment data:</strong> transaction reference numbers only — card details are handled entirely by PayGate and never stored by us.</li>
              <li><strong>Usage data:</strong> pages viewed, search queries, and cart activity to improve your experience.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">2. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Process and fulfil your orders.</li>
              <li>Send order confirmations and shipping updates via email and SMS.</li>
              <li>Improve the Platform and personalise your experience.</li>
              <li>Comply with legal obligations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">3. SMS Notifications</h2>
            <p>
              By providing your phone number at checkout, you consent to receiving transactional SMS
              messages (order confirmations, shipping updates) from Fountstream via LinkSMS. You can
              opt out at any time by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">4. Data Sharing</h2>
            <p>We do not sell your personal data. We share data only with:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Sellers</strong> on our platform — to fulfil your orders.</li>
              <li><strong>PayGate</strong> — for secure card payment processing.</li>
              <li><strong>LinkSMS</strong> — for transactional SMS delivery.</li>
              <li><strong>Resend</strong> — for transactional email delivery.</li>
              <li><strong>Legal authorities</strong> — when required by Botswana law.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">5. Cookies</h2>
            <p>
              We use essential cookies for authentication and session management. We do not use
              third-party advertising cookies. You can control cookies through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">6. Data Security</h2>
            <p>
              We store your data on secure servers. Passwords are hashed with bcrypt and never stored
              in plain text. Payment card details are processed exclusively by PayGate's PCI-DSS
              compliant infrastructure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">7. Your Rights</h2>
            <p>
              You have the right to access, correct, or delete your personal data. To exercise these
              rights, contact us at{" "}
              <a href="mailto:support@fountstream.com" className="text-primary underline">
                support@fountstream.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">8. Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active. Order records are
              kept for 7 years to comply with Botswana financial regulations. You may request deletion
              of non-essential data at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">9. Changes to This Policy</h2>
            <p>
              We may update this policy periodically. We will notify you of material changes via email
              or a prominent notice on the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">10. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy, contact us at{" "}
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
