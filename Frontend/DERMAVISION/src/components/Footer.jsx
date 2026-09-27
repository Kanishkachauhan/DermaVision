import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-[#2B2623] text-[#D8CFCA] pt-16 pb-12 border-t border-[#3D3734]">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-[#DC926E] flex items-center justify-center text-white font-bold text-xs">
                DV
              </div>
              <span className="text-xl font-bold text-white tracking-tight">
                Derma<span className="text-[#DC926E] font-normal">Vision</span>
              </span>
            </div>
            <p className="text-sm text-[#A89F99] leading-relaxed max-w-md">
              DermaVision combines medical-grade computer vision algorithms with clinical diagnostic expertise. We provide high-precision skin telemetry and specialist connectivity—completely non-product diagnostic technology.
            </p>
            <div className="text-xs text-[#8C837E] pt-2">
              Medical Disclaimer: DermaVision provides AI-assisted telehealth telemetry and skin metrics for educational and triage guidance. Always consult a board-certified dermatologist for clinical diagnosis.
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Platform Links
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/home" className="hover:text-[#DC926E] transition-colors">
                  Home Overview
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-[#DC926E] transition-colors">
                  User Login
                </Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-[#DC926E] transition-colors">
                  Create Account
                </Link>
              </li>
              <li>
                <a href="#technology" className="hover:text-[#DC926E] transition-colors">
                  AI Vision Technology
                </a>
              </li>
              <li>
                <a href="#scanner-demo" className="hover:text-[#DC926E] transition-colors">
                  Live Scanner Simulator
                </a>
              </li>
            </ul>
          </div>

          {/* Contact & Support */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Clinical Contact
            </h4>
            <ul className="space-y-2.5 text-sm text-[#A89F99]">
              <li>
                <span className="block text-white text-xs font-medium">Research & Support</span>
                support@dermavision.ai
              </li>
              <li>
                <span className="block text-white text-xs font-medium">Clinical Inquiries</span>
                clinical@dermavision.ai
              </li>
              <li className="pt-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-[#38322F] border border-[#48413E] text-xs text-[#DC926E]">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  AI Model v2.4 Active
                </div>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Section */}
        <div className="border-t border-[#3D3734] pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#8C837E]">
          <p>© 2026 DermaVision AI Inc. All rights reserved. Built with clinical precision.</p>
          <div className="flex gap-6">
            <a href="#privacy" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#terms" className="hover:text-white transition-colors">Terms of Telehealth</a>
            <a href="#security" className="hover:text-white transition-colors">HIPAA Compliance</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;