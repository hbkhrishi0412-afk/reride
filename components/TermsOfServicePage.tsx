import React from 'react';

const TermsOfServicePage: React.FC = () => {
  return (
    <div className="animate-fade-in container mx-auto py-8 max-w-4xl px-4">
      <div className="bg-white rounded-xl shadow-lg p-8 md:p-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold text-reride-text-dark mb-4">
            Terms of Service
          </h1>
          <p className="text-gray-600 text-lg">
            Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="prose prose-lg max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-reride-text-dark mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              By accessing and using ReRide ("we," "our," or "us"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
            <p className="text-gray-700 leading-relaxed">
              These Terms of Service ("Terms") govern your access to and use of our website, mobile application, and related services (collectively, the "Service"). Please read these Terms carefully before using our Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-reride-text-dark mb-4">2. Description of Service</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              ReRide is an online marketplace platform that connects buyers and sellers of vehicles. Our Service allows users to:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4 ml-4">
              <li>Browse and search for vehicles (cars, motorcycles, commercial vehicles, etc.)</li>
              <li>List vehicles for sale or rent</li>
              <li>Communicate with other users through our messaging system</li>
              <li>Access vehicle services and service providers</li>
              <li>Compare vehicles and save favorites</li>
              <li>Access premium features through subscription plans</li>
            </ul>
            <p className="text-gray-700 leading-relaxed">
              We act as an intermediary platform and do not own, sell, or guarantee any vehicles listed on our Service. All transactions are between buyers and sellers.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-reride-text-dark mb-4">3. User Accounts</h2>
            
            <h3 className="text-xl font-semibold text-reride-text-dark mb-3 mt-6">3.1 Account Registration</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              To use certain features of our Service, you must register for an account. You agree to:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4 ml-4">
              <li>Provide accurate, current, and complete information during registration</li>
              <li>Maintain and promptly update your account information</li>
              <li>Maintain the security of your password and account</li>
              <li>Accept responsibility for all activities that occur under your account</li>
              <li>Notify us immediately of any unauthorized use of your account</li>
            </ul>

            <h3 className="text-xl font-semibold text-reride-text-dark mb-3 mt-6">3.2 Account Types</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              We offer different account types:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4 ml-4">
              <li><strong>Customer:</strong> For browsing and purchasing vehicles</li>
              <li><strong>Seller:</strong> For listing and selling vehicles</li>
              <li><strong>Service Provider:</strong> For offering vehicle-related services</li>
              <li><strong>Admin:</strong> For platform administration (by invitation only)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-reride-text-dark mb-4">4. User Conduct and Responsibilities</h2>
            
            <h3 className="text-xl font-semibold text-reride-text-dark mb-3 mt-6">4.1 Prohibited Activities</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              You agree not to:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4 ml-4">
              <li>Post false, misleading, or fraudulent information</li>
              <li>List stolen vehicles or vehicles you do not have the right to sell</li>
              <li>Engage in any fraudulent, deceptive, or illegal activity</li>
              <li>Harass, abuse, or harm other users</li>
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe upon intellectual property rights</li>
              <li>Transmit viruses, malware, or other harmful code</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Interfere with or disrupt the Service</li>
              <li>Use automated systems to scrape or collect data from our Service</li>
              <li>Create multiple accounts to circumvent restrictions</li>
              <li>Impersonate any person or entity</li>
            </ul>

            <h3 className="text-xl font-semibold text-reride-text-dark mb-3 mt-6">4.2 Listing Requirements</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              When listing a vehicle, you must:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4 ml-4">
              <li>Provide accurate and complete information about the vehicle</li>
              <li>Use only photos that accurately represent the vehicle</li>
              <li>Disclose any known defects or issues</li>
              <li>Set a fair and reasonable price</li>
              <li>Respond promptly to inquiries from potential buyers</li>
              <li>Remove listings for vehicles that are no longer available</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-reride-text-dark mb-4">5. Transactions and Payments</h2>
            
            <h3 className="text-xl font-semibold text-reride-text-dark mb-3 mt-6">5.1 Transaction Process</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              ReRide facilitates connections between buyers and sellers but is not a party to any transaction. All transactions are between the buyer and seller directly. We do not:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4 ml-4">
              <li>Guarantee the condition, quality, or authenticity of any vehicle</li>
              <li>Process payments between buyers and sellers (unless using our payment processing features)</li>
              <li>Handle vehicle delivery or transfer</li>
              <li>Provide warranties or guarantees on transactions</li>
            </ul>

            <h3 className="text-xl font-semibold text-reride-text-dark mb-3 mt-6">5.2 Payment Processing</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              If you use our payment processing features:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4 ml-4">
              <li>You agree to pay all fees associated with your use of the Service</li>
              <li>All fees are non-refundable unless otherwise stated</li>
              <li>We reserve the right to change our fee structure at any time</li>
              <li>Payment processing is handled by third-party payment processors</li>
              <li>You are responsible for any taxes applicable to your transactions</li>
            </ul>

            <h3 className="text-xl font-semibold text-reride-text-dark mb-3 mt-6">5.3 Subscription Plans</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              We offer subscription plans with various features. By subscribing:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4 ml-4">
              <li>You agree to pay the subscription fee on a recurring basis</li>
              <li>Subscriptions automatically renew unless cancelled</li>
              <li>You can cancel your subscription at any time</li>
              <li>Cancellation takes effect at the end of the current billing period</li>
              <li>No refunds are provided for partial billing periods</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-reride-text-dark mb-4">6. Intellectual Property</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              The Service and its original content, features, and functionality are owned by ReRide and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              You retain ownership of any content you post on our Service. By posting content, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, adapt, publish, and distribute your content for the purpose of operating and promoting our Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-reride-text-dark mb-4">7. Disclaimers and Limitation of Liability</h2>
            
            <h3 className="text-xl font-semibold text-reride-text-dark mb-3 mt-6">7.1 Service Availability</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              We strive to provide a reliable Service, but we do not guarantee that the Service will be available at all times or free from errors, interruptions, or defects. We reserve the right to modify, suspend, or discontinue the Service at any time without notice.
            </p>

            <h3 className="text-xl font-semibold text-reride-text-dark mb-3 mt-6">7.2 No Warranty</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
            </p>

            <h3 className="text-xl font-semibold text-reride-text-dark mb-3 mt-6">7.3 Limitation of Liability</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, RERIDE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM YOUR USE OF THE SERVICE.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-reride-text-dark mb-4">8. Indemnification</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              You agree to indemnify, defend, and hold harmless ReRide and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable attorneys' fees, arising out of or in any way connected with:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4 ml-4">
              <li>Your use of the Service</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any rights of another party</li>
              <li>Any content you post on the Service</li>
              <li>Your transactions with other users</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-reride-text-dark mb-4">9. Termination</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We may terminate or suspend your account and access to the Service immediately, without prior notice or liability, for any reason, including if you breach these Terms.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              Upon termination, your right to use the Service will cease immediately. You may also terminate your account at any time by contacting us or using the account deletion feature in your settings.
            </p>
            <p className="text-gray-700 leading-relaxed">
              All provisions of these Terms that by their nature should survive termination shall survive termination, including ownership provisions, warranty disclaimers, indemnity, and limitations of liability.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-reride-text-dark mb-4">10. Dispute Resolution</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              If you have a dispute with another user, we encourage you to contact the user directly to resolve the issue. ReRide is not obligated to resolve disputes between users but may assist in facilitating communication.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              Any disputes arising out of or relating to these Terms or the Service shall be resolved through binding arbitration in accordance with the laws of India, unless otherwise required by applicable law.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-reride-text-dark mb-4">11. Changes to Terms</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We reserve the right to modify these Terms at any time. We will notify users of any material changes by posting the new Terms on this page and updating the "Last Updated" date.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Your continued use of the Service after any changes constitutes your acceptance of the new Terms. If you do not agree to the modified Terms, you must stop using the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-reride-text-dark mb-4">12. Governing Law</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              These Terms shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law provisions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-reride-text-dark mb-4">13. Contact Information</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              If you have any questions about these Terms of Service, please contact us:
            </p>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="text-gray-700 mb-2"><strong>Email:</strong> legal@reride.com</p>
              <p className="text-gray-700 mb-2"><strong>Support:</strong> support@reride.com</p>
              <p className="text-gray-700"><strong>Address:</strong> ReRide, India</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServicePage;






