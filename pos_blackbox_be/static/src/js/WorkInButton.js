odoo.define('pos_blackbox_be.WorkInButton', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const ProductScreen = require('point_of_sale.ProductScreen');
    const { useListener } = require('web.custom_hooks');
    const Registries = require('point_of_sale.Registries');
    const { useState } = owl.hooks;

    class WorkInButton extends PosComponent {
        constructor() {
            super(...arguments);
            useListener('click', this.onClick);
            this.state = useState({ status: false, buttonDisabled: false });
        }

        async willStart() {
            this.state.status = await this.get_user_session_status(this.env.pos.pos_session.id, this.get_user_id());
        }

        async onClick() {
            let clocked = await this.get_user_session_status(this.env.pos.pos_session.id, this.get_user_id());
            if(!this.state.status && !clocked)
                this.ClockIn();
            if(this.state.status && clocked)
                this.ClockOut();
        }
        async ClockIn() {
            this.state.buttonDisabled = true;

            try {
                await this.createOrderForClocking();
                await this.set_user_session_status(this.env.pos.pos_session.id, this.get_user_id(), true);
                this.state.status = true;
                this.showScreen('ReceiptScreen');
            } catch(err) {
                console.log(err);
            }
            this.state.buttonDisabled = false;
        }
        async ClockOut() {
            this.state.buttonDisabled = true;

            try {
                await this.createOrderForClocking();
                await this.set_user_session_status(this.env.pos.pos_session.id, this.get_user_id(), false);
                this.state.status = false;
                this.showScreen('ReceiptScreen');
            } catch(err) {
                console.log(err);
            }

            this.state.buttonDisabled = false;
        }
        async set_user_session_status(session, user, status) {
            let users = await this.rpc({
                model: 'pos.session',
                method: 'set_user_session_work_status',
                args: [session, user, status],
            });
            if(this.env.pos.config.module_pos_hr)
                this.env.pos.pos_session.employees_clocked_ids = users;
            else
                this.env.pos.pos_session.users_clocked_ids = users;
        }
        async get_user_session_status(session, user) {
            return await this.rpc({
                model: 'pos.session',
                method: 'get_user_session_work_status',
                args: [session, user],
            });
        }
        async createOrderForClocking() {
            this.env.pos.add_new_order();
            let order = this.env.pos.get_order();
            let add = order.add_product(this.state.status? this.env.pos.work_out_product :this.env.pos.work_in_product, {force: true});
            if(!add)
                throw "Couldn't add product. Check if the product has tax associated";
            order.draft = false;
            order.clock = this.state.status? 'out' : 'in';

            await this.env.pos.push_single_order(order);
        }
        get_user_id() {
            return this.env.pos.config.module_pos_hr ? this.env.pos.get_cashier().id : this.env.pos.pos_session.user_id[0];
        }
    }
    WorkInButton.template = 'WorkInButton';

    ProductScreen.addControlButton({
        component: WorkInButton,
        condition: function() {
            return this.env.pos.useBlackBoxBe();
        },
    });

    Registries.Component.add(WorkInButton);

    return WorkInButton;
});
