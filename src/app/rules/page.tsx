
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rules - TinChat',
  description: 'Community guidelines and rules for using TinChat.',
};

export default function RulesPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-black text-white p-4 min-h-screen">
      <div className="max-w-2xl w-full text-center space-y-6">
        <h1 className="text-4xl font-bold">Community Rules</h1>
        
        <div className="text-left bg-gray-900 p-6 sm:p-8 rounded-lg shadow-xl space-y-4">
          <p className="text-lg">
            Welcome to TinChat! To ensure a safe and enjoyable experience for everyone, please follow these rules:
          </p>
          
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold border-b border-gray-700 pb-2">1. Be Respectful</h2>
            <p>Treat everyone with kindness and respect. Harassment, bullying, hate speech, racism, sexism, or any form of discrimination will not be tolerated.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold border-b border-gray-700 pb-2">2. No Illegal Content or Activities</h2>
            <p>Do not share or promote any content or activities that are illegal in your jurisdiction or the jurisdiction of others. This includes, but is not limited to, child exploitation, illegal drug use, and copyright infringement.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold border-b border-gray-700 pb-2">3. Protect Personal Information</h2>
            <p>Do not share your own or others' personal information, such as full names, addresses, phone numbers, email addresses, social media profiles, or financial information. Be cautious about what you reveal.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold border-b border-gray-700 pb-2">4. No Impersonation</h2>
            <p>Do not impersonate other individuals, celebrities, or TinChat staff.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold border-b border-gray-700 pb-2">5. Age Restrictions</h2>
            <p>Users must be 18 years of age or older. If you are between 13 and 18 years old, you must have consent from a parent or legal guardian to use this service, and they must agree to these rules and our Terms of Service on your behalf.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold border-b border-gray-700 pb-2">6. No Spamming or Malicious Links</h2>
            <p>Do not spam users with unsolicited messages, advertisements, or links to malicious websites (e.g., phishing sites, malware).</p>
          </section>
          
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold border-b border-gray-700 pb-2">7. Content Moderation</h2>
            <p>TinChat reserves the right to moderate content and user activity. Violations of these rules may result in warnings, temporary suspension, or permanent ban from the service without notice.</p>
          </section>

          <p className="text-sm italic mt-6">
            These rules are subject to change. Please review them periodically. By using TinChat, you agree to abide by these rules.
          </p>
        </div>
      </div>
    </div>
  );
}
