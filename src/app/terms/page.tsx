
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service - TinChat',
  description: 'The terms and conditions for using TinChat.',
};

export default function TermsPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-black text-white p-4 min-h-screen">
      <div className="max-w-2xl w-full text-center space-y-6">
        <h1 className="text-4xl font-bold">Terms of Service</h1>
        <p className="text-sm text-gray-400">Last Updated: {new Date().toLocaleDateString()}</p>

        <div className="text-left bg-gray-900 p-6 sm:p-8 rounded-lg shadow-xl space-y-4">
          <p>Welcome to TinChat! These Terms of Service ("Terms") govern your access to and use of the TinChat website, services, and applications (collectively, the "Service"). Please read these Terms carefully.</p>

          <section className="space-y-2">
            <h2 className="text-2xl font-semibold">1. Acceptance of Terms</h2>
            <p>By accessing or using the Service, you agree to be bound by these Terms and our Privacy Policy. If you do not agree to these Terms, do not use the Service.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-2xl font-semibold">2. User Conduct and Responsibilities</h2>
            <p>You are solely responsible for your conduct and any data, text, information, screen names, graphics, photos, profiles, audio and video clips, links ("Content") that you submit, post, and display on the Service. You must comply with our Community Rules, which are incorporated into these Terms by reference.</p>
            <p>Prohibited activities include, but are not limited to: illegal activities, harassment, distributing spam, infringing on intellectual property rights, and transmitting viruses or malicious code.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-2xl font-semibold">3. Age Restriction</h2>
            <p>You must be at least 18 years old to use the Service. If you are between the ages of 13 and 18, you may only use the Service under the supervision of a parent or legal guardian who agrees to be bound by these Terms.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-2xl font-semibold">4. Intellectual Property</h2>
            <p>The Service and its original content, features, and functionality are and will remain the exclusive property of TinChat and its licensors. The Service is protected by copyright, trademark, and other laws.</p>
          </section>
          
          <section className="space-y-2">
            <h2 className="text-2xl font-semibold">5. Disclaimer of Warranties</h2>
            <p>The Service is provided on an "AS IS" and "AS AVAILABLE" basis. TinChat makes no warranties, expressed or implied, regarding the operation or availability of the Service or the information, content, materials, or products included on the Service.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-2xl font-semibold">6. Limitation of Liability</h2>
            <p>In no event shall TinChat, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-2xl font-semibold">7. Termination</h2>
            <p>We may terminate or suspend your access to the Service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms or Community Rules.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-2xl font-semibold">8. Governing Law</h2>
            <p>These Terms shall be governed and construed in accordance with the laws of [Specify Jurisdiction, e.g., "the State of California, United States"], without regard to its conflict of law provisions.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-2xl font-semibold">9. Changes to Terms</h2>
            <p>We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will provide notice of any changes by posting the new Terms on this page. Your continued use of the Service after any such changes constitutes your acceptance of the new Terms.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-2xl font-semibold">10. Contact Us</h2>
            <p>If you have any questions about these Terms, please contact us at [Provide a contact email or link, e.g., support@tinchat.online].</p>
          </section>
        </div>
      </div>
    </div>
  );
}
