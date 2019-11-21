import * as React from 'react';
import {IconStyles} from './IconStyles';

/**
 */
export class EditIcon extends React.PureComponent<IProps, IState> {

    constructor(props: IProps, context: any) {
        super(props, context);
    }

    public render() {

        return (

            <i style={IconStyles.ICON} className="fas fa-pen"/>

        );

    }

}

interface IProps {
}

interface IState {
}
