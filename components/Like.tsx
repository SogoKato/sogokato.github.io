import { HeadlessLike } from "@noroch/like-widget";
import Script from "next/script";
import React from "react";

export default function Like() {
  const style = document.createElement("style");
  style.innerText = `
    .headlessLike__item:disabled {
      background-color: #A3A3A3;
      box-shadow: none;
    }

    .headlessLike__item:disabled .headlessLike__name {
      background-color: #E5E5E5;
    }

    html.dark .headlessLike__item:disabled {
      background-color: #737373;
    }

    html.dark .headlessLike__item:disabled .headlessLike__name {
      background-color: #A3A3A3;
    }

    .headlessLike__item:not(:disabled):hover,
    .headlessLike__item.clicked:disabled,
    .headlessLike__item.clicked-before:disabled {
      background-color: #E38634;
      box-shadow: none;
    }

    html.dark .headlessLike__item:not(:disabled):hover,
    html.dark .headlessLike__item.clicked:disabled,
    html.dark .headlessLike__item.clicked-before:disabled {
      background-color: #824007;
    }

    .headlessLike__item:not(:disabled):hover .headlessLike__name,
    .headlessLike__item.clicked:disabled .headlessLike__name,
    .headlessLike__item.clicked-before:disabled .headlessLike__name {
      background-color: #FFEEE8;
    }

    html.dark .headlessLike__item:not(:disabled):hover .headlessLike__name,
    html.dark .headlessLike__item.clicked:disabled .headlessLike__name,
    html.dark .headlessLike__item.clicked-before:disabled .headlessLike__name {
      background-color: #EBD6CF;
    }
  `;
  document.getElementsByTagName("head")[0].insertAdjacentElement("beforeend", style);
  return (
    <div>
      <div id="likeMessage" className="max-w-xs mx-auto my-5 text-center">＼ いいねしてもらえると喜びます！ ／</div>
      <div className="headlessLike flex flex-wrap justify-between max-w-xs mx-auto my-5"></div>
      <template id="headlessLikeTmpl" dangerouslySetInnerHTML={{
        __html: `<button class="headlessLike__item bg-duchs-500 flex font-bold items-center p-2 rounded-lg shadow-neutral-500 shadow text-neutral-50 transition-all">
          <div class="headlessLike__name bg-neutral-50 flex items-center justify-center h-8 mr-1 rounded-full text-lg transition-all w-8"></div>
          <div class="headlessLike__desc mr-2"></div>
          <div class="headlessLike__count"></div>
          </button>`}} />
      <Script src="https://cdn.jsdelivr.net/npm/@noroch/like-widget@1.0.2/dist/main.min.js"
        onLoad={
          () => {
            HeadlessLike.init("58fcbf0d-e6c1-4e2d-a56f-f95aa56d5be4", {
              postUpdate: (evt, count) => {
                const message = document.getElementById("likeMessage");
                if (message) message.textContent = "いつもありがとうございます！";
              },
            }).then(hl => {
              const elementsClickedBefore = document.querySelectorAll(".headlessLike__item.clicked-before");
              if (elementsClickedBefore.length > 0) {
                const message = document.getElementById("likeMessage");
                if (message) message.textContent = "いつもありがとうございます！";
              }
            });
          }
        }
      />
    </div>
  )
};
