// 'use client';

// import Script from 'next/script';

// export default function BotpressChat() {
//   return (
//     <>
//       <Script
//         src="https://cdn.botpress.cloud/webchat/v3.6/inject.js"
//         strategy="afterInteractive"
//       />

//       <Script
//         id="botpress-config"
//         strategy="afterInteractive"
//         dangerouslySetInnerHTML={{
//           __html: `
//             fetch("https://files.bpcontent.cloud/2026/04/28/08/20260428083312-C3T32LDL.json")
//               .then(function(response) {
//                 return response.json();
//               })
//               .then(function(config) {
//                 window.botpress.init(config);
//               })
//               .catch(function(error) {
//                 console.error("Botpress config load error:", error);
//               });
//           `,
//         }}
//       />
//     </>
//   );
// }

'use client';

import Script from 'next/script';

export default function BotpressChat() {
  return (
    <>
      <Script
        src="https://cdn.botpress.cloud/webchat/v3.6/inject.js"
        strategy="afterInteractive"
      />
      <Script
        src="https://files.bpcontent.cloud/2026/04/28/08/20260428083312-Y7134UFL.js"
        strategy="afterInteractive"
      />
    </>
  );
}