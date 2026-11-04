import React from "react";
import { HiOutlineRefresh, HiOutlineExclamationCircle } from "react-icons/hi";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6 bg-[#FAF8F5]">
          <div className="max-w-md w-full bg-white border border-[#E8DFD8] rounded-2xl p-6 sm:p-8 shadow-sm text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl mx-auto border border-amber-200">
              <HiOutlineExclamationCircle />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#2B2623]">Temporary Display Glitch</h2>
              <p className="text-xs text-[#7A7069] mt-1 leading-relaxed">
                DermaVision's diagnostic view encountered a momentary rendering issue. Your data and session are secure.
              </p>
            </div>
            <button
              onClick={this.handleReset}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#DC926E] hover:bg-[#c87e5b] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <HiOutlineRefresh className="text-sm" />
              <span>Reload Analysis View</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
