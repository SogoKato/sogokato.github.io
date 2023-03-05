import React, { useEffect, useState } from "react";
import { LikeEvent } from "../types/ga";
import { trackEvent } from "../utils/gtag";

type LikeProps = {
  path: string;
};

const Like: React.FC<LikeProps> = ({ path }) => {
  migrateLocalStorage(path);
  const [reactions, setReactions] = useState<IAPIReaction[]>([]);
  const [buttonStates, setButtonStates] = useState<ButtonStates>({});
  const baseUrl =
    window.location.hostname === "sogo.dev"
      ? "https://tcfqlqcnw3.execute-api.ap-northeast-1.amazonaws.com/production"
      : "https://tc8py36661.execute-api.ap-northeast-1.amazonaws.com/staging";
  const clientId = "58fcbf0d-e6c1-4e2d-a56f-f95aa56d5be4";
  useEffect(() => {
    (async () => {
      const url = `${baseUrl}/${clientId}/reactions?pageId=${path}`;
      const response = await fetch(url);
      const json = (await response.json()) as IAPIReactionsResponse;
      setReactions(json.reactions);
      const records = getRecords();
      const tmpStates: ButtonStates = {};
      const disabled = Object.keys(records).includes(path);
      json.reactions.forEach((reaction) => {
        tmpStates[reaction.id] = {
          clicked: false,
          clickedBefore: disabled && records[path] === reaction.id,
          disabled: disabled,
        };
      });
      setButtonStates(tmpStates);
    })();
  }, [path]);
  const buttons = reactions.map((reaction) => {
    const onClick = async () => {
      const url = `${baseUrl}/${clientId}/reactions/${reaction.id}?pageId=${path}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reactionId: reaction.id }),
      });
      const json = (await response.json()) as IAPIReactionResponse;
      const index = reactions.findIndex((r) => r.id === reaction.id);
      const tmp = Array.from(reactions);
      tmp.splice(index, 1, json.reaction);
      setReactions(tmp);
      const tmpStates: ButtonStates = {};
      Object.keys(buttonStates).forEach((reactionId) => {
        if (reactionId == reaction.id) {
          tmpStates[reactionId] = {
            clicked: true,
            clickedBefore: false,
            disabled: true,
          };
        } else {
          tmpStates[reactionId] = {
            clicked: false,
            clickedBefore: false,
            disabled: true,
          };
        }
      });
      const records = getRecords();
      records[path] = reaction.id;
      localStorage.setItem("headlessLikeRecords", JSON.stringify(records));
      setButtonStates(tmpStates);
      trackLikeEvent(reaction.description);
    };
    const statefulClassName = getStatefulClassName(buttonStates[reaction.id]);
    return (
      <button
        className={
          "headlessLike__item bg-duchs-500 flex font-bold items-center mb-8 p-2 rounded-lg shadow-neutral-500 shadow text-neutral-50 transition-all " +
          statefulClassName
        }
        onClick={() => onClick()}
        key={reaction.id}
        disabled={
          buttonStates[reaction.id] ? buttonStates[reaction.id].disabled : false
        }
      >
        <div className="headlessLike__name bg-neutral-50 flex items-center justify-center h-8 mr-1 rounded-full text-lg transition-all w-8">
          {reaction.name}
        </div>
        <div className="mr-2">{reaction.description}</div>
        <div>{reaction.count}</div>
      </button>
    );
  });
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
  document
    .getElementsByTagName("head")[0]
    .insertAdjacentElement("beforeend", style);
  return (
    <div>
      <div id="likeMessage" className="max-w-xs mx-auto my-5 text-center">
        ＼ いいねしてもらえると喜びます！ ／
      </div>
      <div className="headlessLike flex flex-wrap justify-between max-w-xs mx-auto my-5">
        {buttons}
      </div>
    </div>
  );
};

export default Like;

async function pathToSha256(path: string) {
  const uint8 = new TextEncoder().encode(path);
  const digest = await crypto.subtle.digest("SHA-256", uint8);
  return Array.from(new Uint8Array(digest))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}

const migrateLocalStorage = async (path: string) => {
  const records = getRecords();
  const oldKeys = Object.keys(records).filter((key) => key[0] !== "/");
  for (let i = 0; i < oldKeys.length; i++) {
    const pathSha256 = await pathToSha256(path);
    console.log(oldKeys[i] === pathSha256);
    if (oldKeys[i] === pathSha256) {
      records[path] = records[oldKeys[i]];
      delete records[oldKeys[i]];
    }
  }
  localStorage.setItem("headlessLikeRecords", JSON.stringify(records));
};

const getStatefulClassName = (state: ButtonState | undefined): string => {
  if (!state) return "";
  if (state.clicked) return "clicked";
  if (state.clickedBefore) return "clicked-before";
  return "";
};

const getRecords = (): Records => {
  const rawRecords = localStorage.getItem("headlessLikeRecords");
  if (!rawRecords) return {};
  return JSON.parse(rawRecords);
};

const trackLikeEvent = (label: string) => {
  const event: LikeEvent = {
    action: "like",
    category: "button",
    label: label,
  };
  trackEvent(event);
};

interface IAPIReaction {
  id: string;
  name: string;
  description: string;
  count: number;
}

interface IAPIReactionsResponse {
  reactions: IAPIReaction[];
}

interface IAPIReactionResponse {
  reaction: IAPIReaction;
}

interface ButtonState {
  clicked: boolean;
  clickedBefore: boolean;
  disabled: boolean;
}

interface ButtonStates {
  [key: string]: ButtonState;
}

interface Records {
  [key: string]: string;
}
