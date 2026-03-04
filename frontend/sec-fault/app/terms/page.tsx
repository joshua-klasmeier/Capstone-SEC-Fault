"use client";

import Sidebar from "@/components/Sidebar";
import { Scale, Menu } from "lucide-react";
import { useState } from "react";

export default function TermsPage() {
  const [sideBarOpen, setSideBarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      {/* Toggle Button */}
      {!sideBarOpen && (
        <button
          onClick={() => setSideBarOpen(true)}
          className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-accent text-white hover:opacity-90"
        >
          <Menu className="h-4 w-4" />
        </button>
      )}

      {sideBarOpen && <Sidebar toggleSidebar={() => setSideBarOpen(false)} />}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-12">
          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Scale className="h-8 w-8 text-accent" />
              <h1 className="text-4xl font-bold text-text-primary">
                Terms and Conditions
              </h1>
            </div>
            <p className="text-text-secondary">
              Last updated: February 26, 2026
            </p>
          </div>

          <div className="space-y-8 text-text-primary">
            {/* Introduction */}
            <section>
              <p className="leading-relaxed">
                Welcome to SEC Fault. By accessing or using our Automated Finance Reporting Tool, 
                you agree to be bound by these Terms and Conditions. Please read them carefully.
              </p>
            </section>

            {/* 1. Acceptance of Terms */}
            <section>
              <h2 className="text-2xl font-semibold mb-3">1. Acceptance of Terms</h2>
              <p className="leading-relaxed">
                By using SEC Fault, you acknowledge that you have read, understood, and agree to be 
                bound by these Terms and Conditions. If you do not agree, please do not use our service.
              </p>
            </section>

            {/* 2. Description of Service */}
            <section>
              <h2 className="text-2xl font-semibold mb-3">2. Description of Service</h2>
              <p className="leading-relaxed mb-3">
                SEC Fault is an automated finance reporting tool that:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Fetches publicly available SEC filings from the SEC EDGAR database</li>
                <li>Generates plain-English summaries using AI-powered analysis</li>
                <li>Provides financial insights based on user prompts</li>
              </ul>
            </section>

            {/* 3. Educational Purpose */}
            <section>
              <h2 className="text-2xl font-semibold mb-3">3. Educational Purpose</h2>
              <p className="leading-relaxed">
                This tool was developed as part of SP25 CSE 5914 – Knowledge Based Systems course 
                and is intended for educational and informational purposes only.
              </p>
            </section>

            {/* 4. No Financial Advice */}
            <section>
              <h2 className="text-2xl font-semibold mb-3">4. No Financial Advice</h2>
              <p className="leading-relaxed">
                <strong>IMPORTANT:</strong> The summaries and insights provided by SEC Fault are 
                for informational purposes only and should not be construed as financial, investment, 
                or legal advice. The tool uses AI-generated summaries which may contain errors or 
                omissions. Always consult with qualified financial professionals before making any 
                investment decisions.
              </p>
            </section>

            {/* 5. Data Accuracy */}
            <section>
              <h2 className="text-2xl font-semibold mb-3">5. Data Accuracy</h2>
              <p className="leading-relaxed">
                While we strive to provide accurate summaries based on SEC filings, we do not 
                guarantee the accuracy, completeness, or timeliness of any information provided 
                through our service. Users should verify all information independently before 
                relying on it.
              </p>
            </section>

            {/* 6. User Accounts */}
            <section>
              <h2 className="text-2xl font-semibold mb-3">6. User Accounts</h2>
              <p className="leading-relaxed">
                You are responsible for maintaining the confidentiality of your account credentials 
                and for all activities that occur under your account. Notify us immediately of any 
                unauthorized use of your account.
              </p>
            </section>

            {/* 7. Acceptable Use */}
            <section>
              <h2 className="text-2xl font-semibold mb-3">7. Acceptable Use</h2>
              <p className="leading-relaxed mb-3">You agree not to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Use the service for any unlawful purpose or in violation of any regulations</li>
                <li>Attempt to gain unauthorized access to our systems or networks</li>
                <li>Interfere with or disrupt the service or servers</li>
                <li>Use automated means to access the service beyond normal usage</li>
                <li>Redistribute or resell summaries generated by the service without permission</li>
              </ul>
            </section>

            {/* 8. Intellectual Property */}
            <section>
              <h2 className="text-2xl font-semibold mb-3">8. Intellectual Property</h2>
              <p className="leading-relaxed">
                SEC filings are public domain documents provided by the SEC. The summaries and 
                analysis generated by our service, as well as the underlying software and design, 
                are the property of the SEC Fault development team and are protected by applicable 
                intellectual property laws.
              </p>
            </section>

            {/* 9. Third-Party Services */}
            <section>
              <h2 className="text-2xl font-semibold mb-3">9. Third-Party Services</h2>
              <p className="leading-relaxed">
                Our service integrates with third-party services including the SEC EDGAR API and 
                Gemini LLM. We are not responsible for the availability, accuracy, or policies of 
                these third-party services.
              </p>
            </section>

            {/* 10. Limitation of Liability */}
            <section>
              <h2 className="text-2xl font-semibold mb-3">10. Limitation of Liability</h2>
              <p className="leading-relaxed">
                To the maximum extent permitted by law, SEC Fault and its team members shall not 
                be liable for any indirect, incidental, special, consequential, or punitive damages, 
                or any loss of profits or revenues, whether incurred directly or indirectly, or any 
                loss of data, use, goodwill, or other intangible losses resulting from your use of 
                the service.
              </p>
            </section>

            {/* 11. Privacy */}
            <section>
              <h2 className="text-2xl font-semibold mb-3">11. Privacy</h2>
              <p className="leading-relaxed">
                Your use of SEC Fault is also governed by our Privacy Policy. We collect and use 
                information as described in that policy, including authentication through Google 
                and storage of your search history.
              </p>
            </section>

            {/* 12. Changes to Terms */}
            <section>
              <h2 className="text-2xl font-semibold mb-3">12. Changes to Terms</h2>
              <p className="leading-relaxed">
                We reserve the right to modify these Terms and Conditions at any time. Changes 
                will be effective immediately upon posting. Your continued use of the service 
                after changes constitutes acceptance of the modified terms.
              </p>
            </section>

            {/* 13. Termination */}
            <section>
              <h2 className="text-2xl font-semibold mb-3">13. Termination</h2>
              <p className="leading-relaxed">
                We reserve the right to terminate or suspend your access to the service at any 
                time, with or without notice, for any reason, including if we believe you have 
                violated these Terms and Conditions.
              </p>
            </section>

            {/* 14. Governing Law */}
            <section>
              <h2 className="text-2xl font-semibold mb-3">14. Governing Law</h2>
              <p className="leading-relaxed">
                These Terms and Conditions shall be governed by and construed in accordance with 
                the laws of the State of Ohio, United States, without regard to its conflict of 
                law provisions.
              </p>
            </section>

            {/* 15. Contact Information */}
            <section>
              <h2 className="text-2xl font-semibold mb-3">15. Contact Information</h2>
              <p className="leading-relaxed">
                If you have any questions about these Terms and Conditions, please contact the 
                SEC Fault development team through the course instructors at The Ohio State University.
              </p>
            </section>

            {/* Acknowledgment */}
            <section className="bg-surface border border-border rounded-lg p-6 mt-8">
              <p className="text-sm leading-relaxed">
                <strong>Acknowledgment:</strong> By using SEC Fault, you acknowledge that you have 
                read these Terms and Conditions and understand that this is an educational project. 
                The tool should be used for learning and informational purposes only.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
