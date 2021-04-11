import { HTMLStr } from 'polar-shared/src/util/Strings';
import React from 'react';
import {ContentEditableWhitespace} from "../ContentEditableWhitespace";
import { observer } from "mobx-react-lite"
import {NavOpts, BlockIDStr, useBlocksStore, IActiveBlock} from '../store/BlocksStore';
import {ContentEditables} from "../ContentEditables";
import {createActionsProvider} from "../../mui/action_menu/ActionStore";
import {NoteFormatPopper} from "../NoteFormatPopper";
import {NoteContentCanonicalizer} from "./NoteContentCanonicalizer";
import {NoteAction} from "./NoteAction";
import { useHistory } from 'react-router-dom';
import { autorun } from 'mobx'
import {CursorPositions} from "./CursorPositions";
import {Platform, Platforms} from 'polar-shared/src/util/Platforms';

const ENABLE_TRACE_CURSOR_RESET = true;

interface IProps {

    readonly id: BlockIDStr;

    readonly parent: BlockIDStr | undefined;

    readonly content: HTMLStr;

    readonly onChange: (content: HTMLStr) => void;

    readonly className?: string;

    readonly spellCheck?: boolean;

    readonly style?: React.CSSProperties;

    readonly innerRef?: React.MutableRefObject<HTMLDivElement | null>;

    readonly onClick?: (event: React.MouseEvent) => void;

    readonly onKeyDown?: (event: React.KeyboardEvent) => void;

}

const NoteContentEditableElementContext = React.createContext<React.RefObject<HTMLElement | null>>({current: null});

export function useNoteContentEditableElement() {
    return React.useContext(NoteContentEditableElementContext);
}

/**
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand
 *
 */
export const NoteContentEditable = observer((props: IProps) => {

    const [content, setContent] = React.useState(props.content);
    const divRef = React.useRef<HTMLDivElement | null>(null);
    const contentRef = React.useRef(props.content);
    const store = useBlocksStore();
    const history = useHistory();

    const platform = React.useMemo(() => Platforms.get(), []);

    const updateCursorPosition = useUpdateCursorPosition();

    const noteLinkActions = store.getNamedNodes().map(current => ({
        id: current,
        text: current
    }));

    const createNoteActionsProvider = React.useMemo(() => createActionsProvider(noteLinkActions), [noteLinkActions]);

    const handleChange = React.useCallback(() => {

        if (! divRef.current) {
            return;
        }

        function computeNewContent() {

            if (! divRef.current) {
                throw new Error("No element");
            }

            const div = NoteContentCanonicalizer.canonicalizeElement(divRef.current)
            return ContentEditableWhitespace.trim(div.innerHTML);

        }

        const newContent = computeNewContent();

        if (newContent === contentRef.current) {
            // there was no change so skip this.
            return;
        }

        if (ENABLE_TRACE_CURSOR_RESET) {
            console.log("==== handleChange: ")
            console.log("newContent: ", newContent);
        }

        contentRef.current = newContent;
        props.onChange(newContent);

    }, [props]);

    const updateMarkdownFromEditable = React.useCallback(() => {
        handleChange();
    }, [handleChange]);

    const handleKeyUp = React.useCallback((event: React.KeyboardEvent) => {

        // note that we have to first use trim on this because sometimes
        // chrome uses &nbsp; which is dumb
        handleChange();

    }, [handleChange]);

    React.useEffect(() =>
        autorun(() => {

            if (store.active?.id === props.id) {

                if (divRef.current) {

                    if (store.active.pos !== undefined) {
                        updateCursorPosition(divRef.current, store.active)
                    }

                    divRef.current.focus();

                }

            }
        }));

    React.useEffect(() => {

        if (props.content.valueOf() !== contentRef.current.valueOf()) {

            if (ENABLE_TRACE_CURSOR_RESET) {
                console.log(`content differs for ${props.id} (cursor will be reset): `);
                console.log(`    props.content:      '${props.content}'`);
                console.log(`    contentRef.current: '${contentRef.current}'`);
                console.log(`    value of equals:    `, props.content.valueOf() === contentRef.current.valueOf());
            }

            contentRef.current = props.content;

            // https://stackoverflow.com/questions/30242530/dangerouslysetinnerhtml-doesnt-update-during-render/38548616

            // We have to set the content in two place, trigger a re-render
            // (though this might be optional) and then set the innerHTML
            // directly.  React has a bug which won't work on empty strings.

            divRef.current!.innerHTML = props.content;

            if (divRef.current && store.active) {
                updateCursorPosition(divRef.current, store.active, true);
            }

        }

    }, [props.content, props.id, store.active, updateCursorPosition]);

    const handleRef = React.useCallback((current: HTMLDivElement | null) => {

        divRef.current = current;

        if (props.innerRef) {
            props.innerRef.current = current;
        }

    }, [props]);

    const hasEditorSelection = React.useCallback((): boolean => {

        const selection = window.getSelection();

        if (selection) {
            const range = selection.getRangeAt(0);
            return range.cloneContents().textContent !== '';
        } else {
            return false;
        }

    }, []);

    const handleKeyDown = React.useCallback((event: React.KeyboardEvent) => {

        if (! divRef.current) {
            return;
        }

        const cursorAtStart = ContentEditables.cursorAtStart(divRef.current);
        const cursorAtEnd = ContentEditables.cursorAtEnd(divRef.current);

        function abortEvent() {
            event.stopPropagation();
            event.preventDefault();
        }

        const opts: NavOpts = {
            shiftKey: event.shiftKey
        }

        const hasModifiers = event.ctrlKey || event.shiftKey || event.metaKey || event.altKey;

        switch (event.key) {

            case 'ArrowUp':

                if (event.ctrlKey || event.metaKey) {
                    store.collapse(props.id)
                    abortEvent();
                    break;
                }

                if (event.shiftKey && ! ContentEditables.selectionAtStart(divRef.current)) {
                    if (! store.hasSelected()) {
                        // don't handle shift until we allow the range to be selected.
                        break;
                    }
                }

                abortEvent();
                store.navPrev('start', opts);
                break;

            case 'ArrowDown':

                if (event.ctrlKey || event.metaKey) {
                    store.expand(props.id);
                    abortEvent();
                    break;
                }

                if (event.shiftKey && ! ContentEditables.selectionAtEnd(divRef.current)) {
                    if (! store.hasSelected()) {
                        // don't handle shift until we allow the range to be selected.
                        break;
                    }
                }

                abortEvent();
                store.navNext('start', opts);

                break;

            case 'ArrowLeft':

                if (event.metaKey) {
                    console.log("History back");
                    // FIXME: this doesn't seem to work...
                    history.go(-1);
                    abortEvent();
                    break;
                }

                if ((platform === Platform.MACOS && event.shiftKey && event.metaKey) ||
                    (platform === Platform.WINDOWS && event.shiftKey && event.altKey)) {
                    store.doUnIndent(props.id);
                    break;
                }

                if (! hasModifiers) {

                    if (cursorAtStart) {
                        abortEvent();
                        store.navPrev('end', opts);
                    }

                }

                break;

            case 'ArrowRight':

                if (event.metaKey) {
                    console.log("History forward");
                    history.goForward();
                    abortEvent();
                    break;
                }

                if ((platform === Platform.MACOS && event.shiftKey && event.metaKey) ||
                    (platform === Platform.WINDOWS && event.shiftKey && event.altKey)) {
                    store.doIndent(props.id);
                    break;
                }

                if (! hasModifiers) {

                    if (cursorAtEnd) {
                        abortEvent();
                        store.navNext('start', opts);
                    }

                }

                break;

            case 'Backspace':

                if (hasEditorSelection()) {
                    console.log("Not handling Backspace");
                    break;
                }

                // TODO: only do this if there aren't any modifiers I think...
                // don't do a manual delete and just always merge.
                // if (props.parent !== undefined && store.noteIsEmpty(props.id)) {
                //     abortEvent();
                //     store.doDelete([props.id]);
                //     break;
                // }

                if (store.hasSelected()) {
                    abortEvent();
                    store.doDelete([]);
                    break;
                }

                if (cursorAtStart) {

                    // we're at the beginning of a note...

                    const mergeTarget = store.canMerge(props.id);

                    if (mergeTarget) {
                        abortEvent();
                        store.mergeBlocks(mergeTarget.target, mergeTarget.source);
                        break;
                    }

                }

                break;

            case 'Tab':

                if (props.parent !== undefined) {

                    abortEvent();

                    if (event.shiftKey) {
                        store.doUnIndent(props.id);
                    } else {
                        store.doIndent(props.id);
                    }

                }

                break;

            default:
                break;

        }

        if (props.onKeyDown) {
            props.onKeyDown(event);
        }

    }, [hasEditorSelection, history, props, store]);

    return (
        <NoteContentEditableElementContext.Provider value={divRef}>

            <div onKeyDown={handleKeyDown}
                 onKeyUp={handleKeyUp}>

                <NoteAction id={props.id}
                            trigger="[["
                            actionsProvider={createNoteActionsProvider}
                            onAction={(id) => ({
                                type: 'note-link',
                                target: id
                            })}>

                    <NoteFormatPopper onUpdated={updateMarkdownFromEditable} id={props.id}>
                        <div ref={handleRef}
                             onClick={props.onClick}
                             contentEditable={true}
                             spellCheck={props.spellCheck}
                             className={props.className}
                             style={{
                                 outline: 'none',
                                 ...props.style
                             }}
                             dangerouslySetInnerHTML={{__html: content}}/>
                    </NoteFormatPopper>

                </NoteAction>

            </div>

        </NoteContentEditableElementContext.Provider>
    );

});

/**
 * Hook which keeps track of the last nonce we updated to avoid double updates.
 */
function useUpdateCursorPosition() {

    const nonceRef = React.useRef(-1);

    return (editor: HTMLDivElement, activeBlock: IActiveBlock, force?: boolean) => {

        if (force || nonceRef.current !== activeBlock.nonce) {

            try {

                if (activeBlock.pos !== undefined) {

                    doUpdateCursorPosition(editor, activeBlock.pos)
                }

            } finally {
                nonceRef.current = activeBlock.nonce;
            }

        }

    }

}

function doUpdateCursorPosition(editor: HTMLDivElement, pos: 'start' | 'end' | number) {

    if (pos !== undefined) {

        function defineNewRange(range: Range) {

            const sel = window.getSelection();

            editor.focus();

            if (sel) {
                sel.removeAllRanges();
                sel.addRange(range);
            }

        }

        console.log("Updating cursor position to: ", pos);

        editor.focus();

        if (pos === 'start') {
            const range = document.createRange();
            range.setStartAfter(editor)
            range.setEndAfter(editor)
        }

        if (pos === 'end') {

            const end = ContentEditables.computeEndNodeOffset(editor);

            const range = document.createRange();
            range.setStart(end.node, end.offset);
            range.setEnd(end.node, end.offset);

            defineNewRange(range);

        }

        if (typeof pos === 'number') {
            CursorPositions.jumpToPosition(editor, pos)
        }

    }

}
