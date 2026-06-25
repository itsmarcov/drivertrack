export default function LoadingScreen({ message, style }) {
  return (
    <div className="loading-screen" style={style}>
      <div className="nx-loader">
        <div className="nx-loader-logo-wrap">
          <img src="/NAVEXlogo.png" alt="NAVEX" className="nx-loader-logo-base" />
          <div className="nx-loader-fill" />
        </div>
        <div className="nx-loader-bar">
          <div className="nx-loader-bar-track" />
        </div>
        {message && <div className="nx-loader-label">{message}</div>}
      </div>
    </div>
  );
}
