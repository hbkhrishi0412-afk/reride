import React from 'react';

const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="animate-fade-in container mx-auto py-8 max-w-4xl px-4">
      <div className="bg-white rounded-xl shadow-lg p-8 md:p-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold text-reride-text-dark mb-4">
            Privacy Policy
          </h1>
          <p className="text-gray-600 text-lg">
            Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="prose prose-lg max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-reride-text-dark mb-4">1. Introduction</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Welcome to ReRide ("we," "our," or "us"). We are committed to protecting your privacy and ensuring you have a positive experience on our platform. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website and mobile application (collectively, the "Service").
            </p>
            <p className="text-gray-700 leading-relaxed">
              By using our Service, you agree to the collection and use of information in accordance with this policy. If you do not agree with our policies and practices, please do not use our Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-reride-text-dark mb-4">2. Information We Collect</h2>
            
            <h3 className="text-xl font-semibold text-reride-text-dark mb-3 mt-6">2.1 Personal Information</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              We collect information that you provide directly to us, including:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4 ml-4">
              <li>Name, email address, phone number, and postal address</li>
              <li>Account credentials (username, password)</li>
              <li>Payment information (processed securely through third-party payment processors)</li>
              <li>Profile information (profile picture, bio, dealership information)</li>
              <li>Vehicle listing information (photos, descriptions, pricing)</li>
              <li>Communications with other users through our platform</li>
              <li>Support requests and feedback</li>
            </ul>

            <h3 className="text-xl font-semibold text-reride-text-dark mb-3 mt-6">2.2 Automatically Collected Information</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              When you access our Service, we automatically collect certain information, including:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4 ml-4">
              <li>Device information (device type, operating system, unique device identifiers)</li>
              <li>Log data (IP address, browser type, pages visited, time and date of visits)</li>
              <li>Location data (with your permission, for location-based services)</li>
              <li>Usage data (features used, interactions, search queries)</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>

            <h3 className="text-xl font-semibold text-reride-text-dark mb-3 mt-6">2.3 Information from Third Parties</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              We may receive information about you from third-party services, such as:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4 ml-4">
              <li>Social media platforms (when you sign in with social accounts)</li>
              <li>Payment processors (transaction information)</li>
              <li>Analytics providers (usage statistics)</li>
              <li>Verification services (identity verification)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-reride-text-dark mb-4">3. How We Use Your Information</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4 ml-4">
              <li>Provide, maintain, and improve our Service</li>
              <li>Process transactions and send related information</li>
              <li>Create and manage your account</li>
              <li>Facilitate communication between buyers and sellers</li>
              <li>Send you service-related notifications and updates</li>
              <li>Respond to your inquiries and provide customer support</li>
              <li>Detect, prevent, and address technical issues and fraudulent activity</li>
              <li>Personalize your experience and show relevant content</li>
              <li>Send marketing communications (with your consent)</li>
              <li>Comply with legal obligations and enforce our terms</li>
              <li>Conduct analytics and research to improve our Service</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-reride-text-dark mb-4">4. Information Sharing and Disclosure</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We do not sell your personal information. We may share your information in the following circumstances:
            </p>

            <h3 className="text-xl font-semibold text-reride-text-dark mb-3 mt-6">4.1 With Other Users</h3>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4 ml-4">
              <li>Your public profile information (name, profile picture, ratings) is visible to other users</li>
              <li>Vehicle listings you create are publicly visible</li>
              <li>Contact information may be shared when you initiate communication with other users</li>
            </ul>

            <h3 className="text-xl font-semibold text-reride-text-dark mb-3 mt-6">4.2 With Service Providers</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              We may share information with third-party service providers who perform services on our behalf, including:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4 ml-4">
              <li>Payment processors</li>
              <li>Cloud hosting providers</li>
              <li>Analytics providers</li>
              <li>Email service providers</li>
              <li>Customer support platforms</li>
            </ul>

            <h3 className="text-xl font-semibold text-reride-text-dark mb-3 mt-6">4.3 Legal Requirements</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              We may disclose your information if required by law or in response to valid requests by public authorities.
            </p>

            <h3 className="text-xl font-semibold text-reride-text-dark mb-3 mt-6">4.4 Business Transfers</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              In the event of a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-reride-text-dark mb-4">5. Data Security</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your information, we cannot guarantee absolute security.
            </p>
            <p className="text-gray-700 leading-relaxed">
              We use encryption, secure socket layer (SSL) technology, and other industry-standard security measures to safeguard your data.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-reride-text-dark mb-4">6. Your Rights and Choices</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Depending on your location, you may have certain rights regarding your personal information, including:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4 ml-4">
              <li><strong>Access:</strong> Request access to your personal information</li>
              <li><strong>Correction:</strong> Request correction of inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your personal information</li>
              <li><strong>Portability:</strong> Request transfer of your data to another service</li>
              <li><strong>Objection:</strong> Object to processing of your personal information</li>
              <li><strong>Withdrawal of Consent:</strong> Withdraw consent where processing is based on consent</li>
            </ul>
            <p className="text-gray-700 leading-relaxed">
              To exercise these rights, please contact us using the information provided in the "Contact Us" section below.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-reride-text-dark mb-4">7. Cookies and Tracking Technologies</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We use cookies and similar tracking technologies to track activity on our Service and store certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our Service.
            </p>
            <p className="text-gray-700 leading-relaxed">
              We use both session cookies (which expire when you close your browser) and persistent cookies (which remain until deleted or expired).
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-reride-text-dark mb-4">8. Children's Privacy</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Our Service is not intended for children under the age of 18. We do not knowingly collect personal information from children under 18. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-reride-text-dark mb-4">9. International Data Transfers</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Your information may be transferred to and maintained on computers located outside of your state, province, country, or other governmental jurisdiction where data protection laws may differ. By using our Service, you consent to the transfer of your information to our facilities and those third parties with whom we share it as described in this policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-reride-text-dark mb-4">10. Changes to This Privacy Policy</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically for any changes.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Changes to this Privacy Policy are effective when they are posted on this page.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-reride-text-dark mb-4">11. Contact Us</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              If you have any questions about this Privacy Policy, please contact us:
            </p>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="text-gray-700 mb-2"><strong>Email:</strong> privacy@reride.com</p>
              <p className="text-gray-700 mb-2"><strong>Support:</strong> support@reride.com</p>
              <p className="text-gray-700"><strong>Address:</strong> ReRide, India</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;


