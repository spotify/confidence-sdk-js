'use client'

import {useConfidence} from "@spotify-confidence/react";
import {useRouter} from "next/navigation";
import {ReactNode} from "react";

export type MTButtonProps = {
    inverted?: boolean;
    onClick?: () => void;
    children: ReactNode,
    href?: string;
    trackEvent?: string;
}


export function ConfidenceButton(props: MTButtonProps) {

    const invertedCN= "rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
    const nonInvertedCN = "rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"

    const confidence = useConfidence();
    const router = useRouter();

    const cn = props.inverted ? invertedCN : nonInvertedCN

    function onClick() {
        if(props.trackEvent) {
            confidence.track(props.trackEvent);
        }
        if(props.href) {
            router.push(props.href)
        }


    }

    return (
        <button className={cn} onClick={onClick}>
            {props.children}
        </button>
    )
}