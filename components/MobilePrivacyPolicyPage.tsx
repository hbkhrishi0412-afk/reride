import React from 'react';

const MobilePrivacyPolicyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Privacy Policy</h1>
        <p className="text-gray-600 text-sm">
          Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <section className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. Introduction</h2>
            <p className="text-gray-700 text-sm leading-relaxed mb-3">
              Welcome to ReRide ("we," "our," or "us"). We are committed to protecting your privacy and ensuring you have a positive experience on our platform. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website and mobile application (collectively, the "Service").
            </p>
            <p className="text-gray-700 text-sm leading-relaxed">
              By using our Service, you agree to the collection and use of information in accordance with this policy. If you do not agree with our policies and practices, please do not use our Service.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-3">2. Information We Collect</h2>
            
            <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">2.1 Personal Information</h3>
            <p className="text-gray-700 text-sm leading-relaxed mb-2">
              We collect information that you provide directly to us, including:
            </p>
            <ul className="list-disc list-inside text-gray-700 text-sm space-y-1 mb-3 ml-2">
              <li>Name, email address, phone number, and postal address</li>
              <li>Account credentials (username, password)</li>
              <li>Payment information (processed securely)</li>
              <li>Profile information (profile picture, bio, dealership information)</li>
              <li>Vehicle listing information (photos, descriptions, pricing)</li>
              <li>Communications with other users through our platform</li>
              <li>Support requests and feedback</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">2.2 Automatically Collected Information</h3>
            <p className="text-gray-700 text-sm leading-relaxed mb-2">
              When you access our Service, we automatically collect certain information, including:
            </p>
            <ul className="list-disc list-inside text-gray-700 text-sm space-y-1 mb-3 ml-2">
              <li>Device information (device type, operating system, unique device identifiers)</li>
              <li>Log data (IP address, browser type, pages visited, time and date of visits)</li>
              <li>Location data (with your permission, for location-based services)</li>
              <li>Usage data (features used, interactions, search queries)</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. How We Use Your Information</h2>
            <p className="text-gray-700 text-sm leading-relaxed mb-2">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-gray-700 text-sm space-y-1 mb-3 ml-2">
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
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-3">4. Information Sharing and Disclosure</h2>
            <p className="text-gray-700 text-sm leading-relaxed mb-2">
              We do not sell your personal information. We may share your information in the following circumstances:
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">4.1 With Other Users</h3>
            <ul className="list-disc list-inside text-gray-700 text-sm space-y-1 mb-3 ml-2">
              <li>Your public profile information is visible to other users</li>
              <li>Vehicle listings you create are publicly visible</li>
              <li>Contact information may be shared when you initiate communication</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">4.2 With Service Providers</h3>
            <p className="text-gray-700 text-sm leading-relaxed mb-2">
              We may share information with third-party service providers who perform services on our behalf, including payment processors, cloud hosting providers, analytics providers, and customer support platforms.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">4.3 Legal Requirements</h3>
            <p className="text-gray-700 text-sm leading-relaxed mb-3">
              We may disclose your information if required by law or in response to valid requests by public authorities.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-3">5. Data Security</h2>
            <p className="text-gray-700 text-sm leading-relaxed mb-3">
              We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. We use encryption, secure socket layer (SSL) technology, and other industry-standard security measures to safeguard your data.
            </p>
            <p className="text-gray-700 text-sm leading-relaxed">
              However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your information, we cannot guarantee absolute security.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-3">6. Your Rights and Choices</h2>
            <p className="text-gray-700 text-sm leading-relaxed mb-2">
              Depending on your location, you may have certain rights regarding your personal information, including:
            </p>
            <ul className="list-disc list-inside text-gray-700 text-sm space-y-1 mb-3 ml-2">
              <li><strong>Access:</strong> Request access to your personal information</li>
              <li><strong>Correction:</strong> Request correction of inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your personal information</li>
              <li><strong>Portability:</strong> Request transfer of your data to another service</li>
              <li><strong>Objection:</strong> Object to processing of your personal information</li>
              <li><strong>Withdrawal of Consent:</strong> Withdraw consent where processing is based on consent</li>
            </ul>
            <p className="text-gray-700 text-sm leading-relaxed">
              To exercise these rights, please contact us using the information provided in the "Contact Us" section below.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-3">7. Cookies and Tracking Technologies</h2>
            <p className="text-gray-700 text-sm leading-relaxed mb-3">
              We use cookies and similar tracking technologies to track activity on our Service and store certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our Service.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-3">8. Children's Privacy</h2>
            <p className="text-gray-700 text-sm leading-relaxed">
              Our Service is not intended for children under the age of 18. We do not knowingly collect personal information from children under 18. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-3">9. Changes to This Privacy Policy</h2>
            <p className="text-gray-700 text-sm leading-relaxed mb-3">
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically for any changes.
            </p>
            <p className="text-gray-700 text-sm leading-relaxed">
              Changes to this Privacy Policy are effective when they are posted on this page.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-3">10. Contact Us</h2>
            <p className="text-gray-700 text-sm leading-relaxed mb-3">
              If you have any questions about this Privacy Policy, please contact us:
            </p>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-700 text-sm mb-2"><strong>Email:</strong> privacy@reride.com</p>
              <p className="text-gray-700 text-sm mb-2"><strong>Support:</strong> support@reride.com</p>
              <p className="text-gray-700 text-sm"><strong>Address:</strong> ReRide, India</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default MobilePrivacyPolicyPage;






