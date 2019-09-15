// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

"use strict";

let uid;

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    // console.log(details);
    if (!/https:\/\/(.*?).medium.com\//g.test(details.url)) {
      return {
        requestHeaders: details.requestHeaders
      };
    }
    const headers = details.requestHeaders;
    const index = headers.findIndex(
      (key) => key.name.toLowerCase() === "cookie"
    );
    if (~index) {
      const cookie = headers[index];
      const match = /\suid=(.*?);/g.exec(cookie.value);
      if (match) {
        if (match[1].includes("lo_")) {
          return {
            requestHeaders: details.requestHeaders
          };
        }
        uid = match[1];
        cookie.value = cookie.value.replace(/\suid=(.*?);/g, "");
      }
    }
    return { requestHeaders: details.requestHeaders };
  },
  { urls: ["https://*.medium.com/*"] },
  ["blocking", "requestHeaders", "extraHeaders"]
);

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (uid) {
      // console.log(uid);
      const index = details.responseHeaders.findIndex(
        (key) => key.name === "set-cookie" && /^uid=/.test(key.value)
      );
      if (~index) {
        const cookie = details.responseHeaders[index];
        cookie.value = cookie.value.replace(/(?<=uid=)(.*?);/g, uid + ";");
      }
    }
    return { responseHeaders: details.responseHeaders };
  },
  { urls: ["https://*.medium.com/*"] },
  ["blocking", "responseHeaders", "extraHeaders"]
);
