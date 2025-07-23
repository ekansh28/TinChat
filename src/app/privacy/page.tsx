
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - TinChat',
  description: 'How TinChat handles your information and privacy.',
};

export default function PrivacyPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-black text-white p-4 min-h-screen">
      <div className="max-w-2xl w-full text-center space-y-6">
        <h1 className="text-4xl font-bold">Privacy Policy</h1>
        <p className="text-sm text-gray-400">Last Updated: {new Date().toLocaleDateString()}</p>

        <div className="text-left bg-gray-900 p-6 sm:p-8 rounded-lg shadow-xl space-y-4">
          <p>TinChat ("us", "we", or "our") operates the TinChat website (the "Service"). This page informs you of our policies regarding the collection, use, and disclosure of personal data when you use our Service and the choices you have associated with that data.</p>
          <p>We aim to collect as little personal information as possible to provide and improve the Service. By using the Service, you agree to the collection and use of information in accordance with this policy.</p>

          <section className="space-y-2">
            <h2 className="text-2xl font-semibold">1. Information Collection and Use</h2>
            <p>We collect several different types of information for various purposes to provide and improve our Service to you.</p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li><strong>Interests (Optional):</strong> If you voluntarily provide interests, we use this information solely to attempt to match you with other users who share similar interests. This information is not permanently stored with an identifiable profile after your session.</li>
              <li><strong>Usage Data:</strong> We may collect information that your browser sends whenever you visit our Service or when you access the Service by or through a mobile device ("Usage Data"). This Usage Data may include information such as your computer's Internet Protocol address (e.g., IP address), browser type, browser version, the pages of our Service that you visit, the time and date of your visit, the time spent on those pages, unique device identifiers, and other diagnostic data. This data is used for operational purposes, such as monitoring server load and preventing abuse.</li>
              <li><strong>Chat Content:</strong> Chat messages exchanged during a session are transmitted through our servers to facilitate communication between users. We do not permanently store chat logs tied to identifiable users beyond the active session for moderation and safety purposes, unless required by law or for investigating violations of our Terms of Service.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-2xl font-semibold">2. How We Use Your Information</h2>
            <p>TinChat uses the collected data for various purposes:</p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li>To provide and maintain our Service</li>
              <li>To facilitate user matching based on shared interests (if provided)</li>
              <li>To monitor the usage of our Service</li>
              <li>To detect, prevent, and address technical issues</li>
              <li>To ensure the safety and security of our users and platform</li>
              <li>To enforce our Terms of Service and Community Rules</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-2xl font-semibold">3. Information Sharing and Disclosure</h2>
            <p>We do not sell your personal information to third parties.</p>
            <p>We may disclose your information if required to do so by law or in response to valid requests by public authorities (e.g., a court or a government agency). We may also disclose information if we believe it's necessary to investigate potential violations of our policies, to protect the rights, property, or safety of TinChat, our users, or the public.</p>
          </section>
          
          <section className="space-y-2">
            <h2 className="text-2xl font-semibold">4. Data Security</h2>
            <p>The security of your data is important to us, but remember that no method of transmission over the Internet or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your Personal Data, we cannot guarantee its absolute security.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-2xl font-semibold">5. Cookies and Tracking Technologies</h2>
            <p>We may use cookies and similar tracking technologies to track the activity on our Service and hold certain information. Cookies are files with a small amount of data which may include an anonymous unique identifier.</p>
            <ul className="list-disc list-inside pl-4 space-y-1">
                <li><strong>Theme Preferences:</strong> We use localStorage (similar to cookies) to remember your chosen theme preference if you change it from the default.</li>
                <li><strong>Firebase Analytics:</strong> We use Firebase Analytics to collect anonymous usage data to understand how our Service is used and to improve it. This may involve cookies set by Google. You can learn more about Google's privacy practices at <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">policies.google.com/privacy</a>.</li>
            </ul>
            <p>You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, some portions of our Service may not function properly.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-2xl font-semibold">6. Children's Privacy</h2>
            <p>Our Service is not directed to anyone under the age of 13 ("Children"). We do not knowingly collect personally identifiable information from children under 13. If you are a parent or guardian and you are aware that your Child has provided us with Personal Data, please contact us. If we become aware that we have collected Personal Data from children without verification of parental consent, we take steps to remove that information from our servers.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-2xl font-semibold">7. Changes to This Privacy Policy</h2>
            <p>We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page. You are advised to review this Privacy Policy periodically for any changes.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-2xl font-semibold">8. Contact Us</h2>
            <p>If you have any questions about this Privacy Policy, please contact us at [Provide a contact email or link, e.g., privacy@tinchat.online].</p>
          </section>
        </div>
      </div>
    </div>
  );
}
