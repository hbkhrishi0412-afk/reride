import React from 'react';

const MobileTermsOfServicePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Terms of Service</h1>
        <p className="text-gray-600 text-sm">
          Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <section className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. Acceptance of Terms</h2>
            <p className="text-gray-700 text-sm leading-relaxed mb-3">
              By accessing and using ReRide, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
            <p className="text-gray-700 text-sm leading-relaxed">
              These Terms of Service ("Terms") govern your access to and use of our website, mobile application, and related services (collectively, the "Service"). Please read these Terms carefully before using our Service.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-3">2. Description of Service</h2>
            <p className="text-gray-700 text-sm leading-relaxed mb-2">
              ReRide is an online marketplace platform that connects buyers and sellers of vehicles. Our Service allows users to:
            </p>
            <ul className="list-disc list-inside text-gray-700 text-sm space-y-1 mb-3 ml-2">
              <li>Browse and search for vehicles</li>
              <li>List vehicles for sale or rent</li>
              <li>Communicate with other users</li>
              <li>Access vehicle services and service providers</li>
              <li>Compare vehicles and save favorites</li>
              <li>Access premium features through subscription plans</li>
            </ul>
            <p className="text-gray-700 text-sm leading-relaxed">
              We act as an intermediary platform and do not own, sell, or guarantee any vehicles listed on our Service. All transactions are between buyers and sellers.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. User Accounts</h2>
            
            <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">3.1 Account Registration</h3>
            <p className="text-gray-700 text-sm leading-relaxed mb-2">
              To use certain features of our Service, you must register for an account. You agree to:
            </p>
            <ul className="list-disc list-inside text-gray-700 text-sm space-y-1 mb-3 ml-2">
              <li>Provide accurate, current, and complete information</li>
              <li>Maintain and promptly update your account information</li>
              <li>Maintain the security of your password and account</li>
              <li>Accept responsibility for all activities under your account</li>
              <li>Notify us immediately of any unauthorized use</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">3.2 Account Types</h3>
            <p className="text-gray-700 text-sm leading-relaxed mb-2">
              We offer different account types: Customer (for browsing and purchasing), Seller (for listing vehicles), Service Provider (for offering services), and Admin (by invitation only).
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-3">4. User Conduct and Responsibilities</h2>
            
            <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">4.1 Prohibited Activities</h3>
            <p className="text-gray-700 text-sm leading-relaxed mb-2">
              You agree not to:
            </p>
            <ul className="list-disc list-inside text-gray-700 text-sm space-y-1 mb-3 ml-2">
              <li>Post false, misleading, or fraudulent information</li>
              <li>List stolen vehicles or vehicles you don't have the right to sell</li>
              <li>Engage in any fraudulent, deceptive, or illegal activity</li>
              <li>Harass, abuse, or harm other users</li>
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe upon intellectual property rights</li>
              <li>Transmit viruses, malware, or other harmful code</li>
              <li>Interfere with or disrupt the Service</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">4.2 Listing Requirements</h3>
            <p className="text-gray-700 text-sm leading-relaxed mb-2">
              When listing a vehicle, you must provide accurate information, use accurate photos, disclose known defects, set fair prices, respond promptly to inquiries, and remove listings for unavailable vehicles.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-3">5. Transactions and Payments</h2>
            
            <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">5.1 Transaction Process</h3>
            <p className="text-gray-700 text-sm leading-relaxed mb-3">
              ReRide facilitates connections between buyers and sellers but is not a party to any transaction. All transactions are between the buyer and seller directly. We do not guarantee the condition, quality, or authenticity of any vehicle.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">5.2 Payment Processing</h3>
            <p className="text-gray-700 text-sm leading-relaxed mb-2">
              If you use our payment processing features, you agree to pay all fees, which are non-refundable unless otherwise stated. Payment processing is handled by third-party payment processors, and you are responsible for any applicable taxes.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">5.3 Subscription Plans</h3>
            <p className="text-gray-700 text-sm leading-relaxed mb-3">
              We offer subscription plans that automatically renew unless cancelled. You can cancel at any time, and cancellation takes effect at the end of the current billing period. No refunds are provided for partial billing periods.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-3">6. Intellectual Property</h2>
            <p className="text-gray-700 text-sm leading-relaxed mb-3">
              The Service and its original content are owned by ReRide and protected by international intellectual property laws. You retain ownership of content you post, but grant us a license to use it for operating and promoting our Service.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-3">7. Disclaimers and Limitation of Liability</h2>
            <p className="text-gray-700 text-sm leading-relaxed mb-3">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND. TO THE MAXIMUM EXTENT PERMITTED BY LAW, RERIDE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-3">8. Termination</h2>
            <p className="text-gray-700 text-sm leading-relaxed mb-3">
              We may terminate or suspend your account immediately, without prior notice, for any reason, including if you breach these Terms. You may also terminate your account at any time by contacting us or using the account deletion feature.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-3">9. Changes to Terms</h2>
            <p className="text-gray-700 text-sm leading-relaxed mb-3">
              We reserve the right to modify these Terms at any time. We will notify users of material changes by posting the new Terms on this page. Your continued use of the Service after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-3">10. Contact Information</h2>
            <p className="text-gray-700 text-sm leading-relaxed mb-3">
              If you have any questions about these Terms of Service, please contact us:
            </p>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-700 text-sm mb-2"><strong>Email:</strong> legal@reride.com</p>
              <p className="text-gray-700 text-sm mb-2"><strong>Support:</strong> support@reride.com</p>
              <p className="text-gray-700 text-sm"><strong>Address:</strong> ReRide, India</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default MobileTermsOfServicePage;







