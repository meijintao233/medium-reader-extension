// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

"use strict";

let uid;
let optimizelyEndUserId;
let lightstep_session_id;

const replaceCookie = (details = {}, useOrigin = false) => {
  const headers = details.requestHeaders || [];
  const index = headers.findIndex((key) => key.name.toLowerCase() === "cookie");
  if (~index) {
    const cookie = headers[index];
    const match = /\suid=(.*?);/g.exec(cookie.value);
    if (match) {
      if (match[1].includes("lo_")) {
        return {
          requestHeaders: details.requestHeaders
        };
      }
      uid = match[1] || uid;
      optimizelyEndUserId = uid;

      const matchSessionId = /\slightstep_session_id=(.*?);/g.exec(
        cookie.value
      );

      lightstep_session_id =
        matchSessionId && (!lightstep_session_id || uid.includes("lo_"))
          ? matchSessionId[1]
          : lightstep_session_id || "";

      cookie.value = cookie.value
        .replace(/\suid=(.*?);/g, useOrigin ? ` uid=${uid};` : "")
        .replace(
          /\soptimizelyEndUserId=(.*?);/g,
          useOrigin ? ` optimizelyEndUserId=${uid};` : ""
        )
        .replace(
          /\slightstep_session_id=(.*?);/g,
          useOrigin ? ` lightstep_session_id=${lightstep_session_id};` : ""
        );
    }
  }
};

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    // console.log(details);
    if (
      !/https:\/\/(.*?).?medium.com\//g.test(details.url) ||
      /https:\/\/(.*?).?medium.com\/?$/g.test(details.url) ||
      /\/api\/activity-status/g.test(details.url) ||
      /\/api\/activity/g.test(details.url) ||
      /_\/batch/g.test(details.url) ||
      details.url.includes("https://medium.com/?source=")
    ) {
      replaceCookie(details, true);
      return {
        requestHeaders: details.requestHeaders
      };
    }
    if (/(\?|%3F)source(=|%3D)/.test(details.url)) {
      replaceCookie(details);
    }
    // const headers = details.requestHeaders;
    return { requestHeaders: details.requestHeaders };
  },
  { urls: ["https://*.medium.com/*"] },
  ["blocking", "requestHeaders", "extraHeaders"]
);

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    let lightstep_session_id;
    const responseHeaders = uid
      ? details.responseHeaders.reduce((total, responseHeader) => {
          if (
            responseHeader.name === "set-cookie" &&
            /^uid=/.test(responseHeader.value)
          ) {
            return [
              ...total,
              {
                name: responseHeader.name,
                value: responseHeader.value.replace(
                  /(?<=uid=)(.*?);/g,
                  uid + ";"
                )
              }
            ];
          }

          if (
            responseHeader.name === "set-cookie" &&
            /^lightstep_session_id=/.test(responseHeader.value)
          ) {
            return [
              ...total,
              {
                name: responseHeader.name,
                value: responseHeader.value.replace(
                  /(?<=lightstep_session_id=)(.*?);/g,
                  lightstep_session_id + ";"
                )
              }
            ];
          }

          if (
            responseHeader.name === "set-cookie" &&
            /^xsrf=/.test(responseHeader.value)
          ) {
            if (!lightstep_session_id) {
              lightstep_session_id = responseHeader.value;
            }
          }

          if (
            responseHeader.name === "set-cookie" &&
            /^optimizelyEndUserId=/.test(responseHeader.value)
          ) {
            return [
              ...total,
              {
                name: responseHeader.name,
                value: responseHeader.value.replace(
                  /(?<=optimizelyEndUserId=)(.*?);/g,
                  uid + ";"
                )
              }
            ];
          }

          return [...total, responseHeader];
        }, [])
      : details.responseHeaders;

    if (lightstep_session_id) {
      responseHeaders.push({
        name: lightstep_session_id,
        value: lightstep_session_id.replace(
          /xsrf=(.*?);/,
          `lightstep_session_id=${lightstep_session_id};`
        )
      });
    }

    return { responseHeaders };
  },
  { urls: ["https://*.medium.com/*"] },
  ["blocking", "responseHeaders", "extraHeaders"]
);
