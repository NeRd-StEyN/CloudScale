import React, { useState } from 'react';

interface CloudScaleLogoProps {
  className?: string;
  size?: number;
}

export const CloudScaleLogo: React.FC<CloudScaleLogoProps> = ({ className = 'h-8 w-auto', size = 32 }) => {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <polygon
          points="16,2 29,9.5 29,24.5 16,32 3,24.5 3,9.5"
          stroke="#10b981"
          strokeWidth="2.5"
          strokeLinejoin="round"
          fill="#064e3b"
          fillOpacity="0.4"
        />
        <line x1="16" y1="2" x2="16" y2="32" stroke="#34d399" strokeWidth="1.5" strokeOpacity="0.6" />
        <line x1="3" y1="9.5" x2="29" y2="24.5" stroke="#34d399" strokeWidth="1.5" strokeOpacity="0.6" />
        <line x1="3" y1="24.5" x2="29" y2="9.5" stroke="#34d399" strokeWidth="1.5" strokeOpacity="0.6" />
        <circle cx="16" cy="17" r="3" fill="#4edea3" />
      </svg>
    );
  }

  return (
    <img
      src="https://lh3.googleusercontent.com/aida/AEtjO1UN1xhqJlxF7J7ooE-Eu92o2oNwncmUmSv0pNyg1wIu4bETd4pBPn2h5pwzy94szp21gJMKvpVB3PnZprkymxrrdAXSbw0XJ_aM3pAzWsYg2Hsa-43nQOcnme0_gRUmJvMSopx_Jpb2TgIslK9F-tOIE4l8vZ_NV7DX3fJFmwFdfR_8pQVFn85gKse5g8FfQD0p41xUChEChy1T6b_hBVVKGvFvw9rx-BdwqtMlakVdFH_wXea9_QJkbQE"
      alt="CloudScale Geometric Hex Logo"
      className={className}
      onError={() => setImgError(true)}
      referrerPolicy="no-referrer"
    />
  );
};
