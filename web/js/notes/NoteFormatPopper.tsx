import ClickAwayListener from '@material-ui/core/ClickAwayListener';
import React from 'react';
import {NoteFormatBar, NoteFormatBarProps} from "./NoteFormatBar";
import {useNoteFormatHandlers} from "./NoteFormatHooks";
import { observer } from "mobx-react-lite"
import { useNotesStore } from './store/NotesStore';

export interface INoteFormatBarPosition {

    /**
     * Where we should be placing the menu when it needs to be ABOVE the text.
     */
    readonly bottom: number;

    /**
     * Where we should be placing the menu when it needs to be BELOW the text.
     */
    readonly top: number;

    readonly left: number;

}

export interface IProps extends NoteFormatBarProps {
    readonly children: JSX.Element;

    readonly onUpdated: () => void;

}

export const NoteFormatPopper = observer(function NoteFormatPopper(props: IProps) {

    const [position, setPosition] = React.useState<INoteFormatBarPosition | undefined>(undefined);
    const timeoutRef = React.useRef<number | undefined>(undefined);

    const notesStore = useNotesStore();

    const {selected} = notesStore;

    // FIXME listen to selected in the store and if it's not empty then clear the popup..

    const doPopup = React.useCallback((): boolean => {

        if (Object.keys(notesStore.selected).length > 0) {
            return false;
        }

        const range = window.getSelection()!.getRangeAt(0);

        if (range.collapsed) {

            if (position) {
                setPosition(undefined);
            }

            return false;
        }

        const bcr = range.getBoundingClientRect();

        setPosition({
            top: bcr.bottom,
            bottom: bcr.top,
            left: bcr.left
        })

        return true;

    }, [notesStore.selected, position]);

    const clearPopup = React.useCallback(() => {

        setPosition(undefined);

    }, [])

    const clearPopupTimeout = React.useCallback(() => {

        if (timeoutRef.current !== undefined) {
            clearTimeout(timeoutRef.current);
        }

    }, [])

    const doPopupWithTimeout = React.useCallback(() => {

        clearPopupTimeout();

        timeoutRef.current = window.setTimeout(() => doPopup(), 350);

    }, [clearPopupTimeout, doPopup]);

    const onMouseUp = React.useCallback(() => {

        doPopupWithTimeout();

    }, [doPopupWithTimeout]);

    const onKeyUp = React.useCallback((event: React.KeyboardEvent) => {

        if (position !== undefined) {

            if (event.key === 'Escape') {
                clearPopup();
            }

        } else {
            doPopupWithTimeout();
        }

    }, [clearPopup, doPopupWithTimeout, position]);

    React.useEffect(() => {

        if (Object.keys(selected).length !== 0) {
            clearPopup();
        }

    }, [clearPopup, selected]);

    const noteFormatHandlers = useNoteFormatHandlers(props.onUpdated);

    return (
        <ClickAwayListener onClickAway={() => setPosition(undefined)}>

            <div onMouseUp={onMouseUp} onKeyUp={onKeyUp}>
                {props.children}

                {position && (
                    <div onClick={() => setPosition(undefined)}
                         style={{
                             position: 'absolute',
                             top: position.top,
                             left: position.left,
                             paddingTop: '5px',
                             paddingBottom: '5px'
                         }}>

                        <NoteFormatBar {...noteFormatHandlers}
                                       onDispose={() => setPosition(undefined)}
                                       onLink={props.onLink}/>

                    </div>
                )}

            </div>

        </ClickAwayListener>

    );

});
