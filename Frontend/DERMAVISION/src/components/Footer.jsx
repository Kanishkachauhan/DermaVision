import React from 'react'


const Footer = () => {
  return (
    <footer className="bg-[#F3CAB6] text-gray-700">
      <div className="max-w-7xl mx-auto px-4 md:px-10 py-10">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* DermaVision Info */}
          <div>
            <h2 className="text-2xl font-bold text-[#DC926E] mb-3">
              DermaVision
            </h2>

            <p className="text-sm leading-6">
              Your smart skincare companion. Analyze your skin, discover
              suitable skincare products, and find dermatologists near you.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold text-[#DC926E] mb-3">
              Quick Links
            </h3>

            <ul className="space-y-2">
              <li>
                <a href="#" className="hover:text-[#DC926E]">
                  Home
                </a>
              </li>

              <li>
                <a href="#" className="hover:text-[#DC926E]">
                  Skin Scan
                </a>
              </li>

              <li>
                <a href="#" className="hover:text-[#DC926E]">
                  Products
                </a>
              </li>

              <li>
                <a href="#" className="hover:text-[#DC926E]">
                  Dermatologists
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-semibold text-[#DC926E] mb-3">
              Contact Us
            </h3>

            <p className="text-sm mb-2">
              Have questions? We're here to help.
            </p>

            <p className="text-sm">
              Email: support@dermavision.com
            </p>
          </div>

        </div>

        {/* Bottom Section */}
        <div className="border-t border-[#DC926E] mt-8 pt-5 text-center">
          <p className="text-sm">
            © 2026 DermaVision. All rights reserved.
          </p>
        </div>

      </div>
    </footer>
  );
};

export default Footer;