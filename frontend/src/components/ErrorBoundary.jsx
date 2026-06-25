import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page" style={{ textAlign: 'center', paddingTop: '4rem' }}>
          <div className="nx-empty-icon">⚠️</div>
          <h2>حدث خطأ غير متوقع</h2>
          <p style={{ color: '#6B7280', marginBottom: '1.5rem' }}>يرجى إعادة تحميل الصفحة</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            إعادة تحميل
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
