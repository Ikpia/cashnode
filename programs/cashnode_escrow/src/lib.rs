use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, Transfer};

declare_id!("HSo8cgjmAttDUi7rpLUEz8QUmq1SUw4yA2eqPgwdThzz");

const STATUS_OPEN: u8 = 0;
const STATUS_ACCEPTED: u8 = 1;
const STATUS_PAID: u8 = 2;

#[program]
pub mod cashnode_escrow {
    use super::*;

    pub fn create_request(
        ctx: Context<CreateRequest>,
        reference_seed: [u8; 32],
        amount_units: u64,
        agent_fee_units: u64,
        platform_fee_units: u64,
    ) -> Result<()> {
        require!(amount_units > 0, CashNodeEscrowError::InvalidAmount);

        let total_units = amount_units
            .checked_add(agent_fee_units)
            .and_then(|amount| amount.checked_add(platform_fee_units))
            .ok_or(CashNodeEscrowError::AmountOverflow)?;
        let now = Clock::get()?.unix_timestamp;

        {
            let request = &mut ctx.accounts.request;
            request.sender = ctx.accounts.sender.key();
            request.agent = Pubkey::default();
            request.token_mint = ctx.accounts.token_mint.key();
            request.vault_token_account = ctx.accounts.vault_token_account.key();
            request.reference_seed = reference_seed;
            request.amount_units = amount_units;
            request.agent_fee_units = agent_fee_units;
            request.platform_fee_units = platform_fee_units;
            request.status = STATUS_OPEN;
            request.created_at = now;
            request.accepted_at = 0;
            request.paid_at = 0;
            request.bump = ctx.bumps.request;
            request.vault_bump = ctx.bumps.vault_token_account;
        }

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.sender_token_account.to_account_info(),
                    to: ctx.accounts.vault_token_account.to_account_info(),
                    authority: ctx.accounts.sender.to_account_info(),
                },
            ),
            total_units,
        )?;

        Ok(())
    }

    pub fn accept_request(ctx: Context<AcceptRequest>) -> Result<()> {
        let request = &mut ctx.accounts.request;

        require!(request.status == STATUS_OPEN, CashNodeEscrowError::InvalidStatus);

        request.agent = ctx.accounts.agent.key();
        request.status = STATUS_ACCEPTED;
        request.accepted_at = Clock::get()?.unix_timestamp;

        Ok(())
    }

    pub fn mark_paid(ctx: Context<AgentRequest>) -> Result<()> {
        let request = &mut ctx.accounts.request;

        require!(request.status == STATUS_ACCEPTED, CashNodeEscrowError::InvalidStatus);
        require_keys_eq!(request.agent, ctx.accounts.agent.key(), CashNodeEscrowError::UnauthorizedAgent);

        request.status = STATUS_PAID;
        request.paid_at = Clock::get()?.unix_timestamp;

        Ok(())
    }

    pub fn complete_request(ctx: Context<CompleteRequest>) -> Result<()> {
        let request = &ctx.accounts.request;

        require!(
            request.status == STATUS_ACCEPTED || request.status == STATUS_PAID,
            CashNodeEscrowError::InvalidStatus
        );
        require!(request.agent != Pubkey::default(), CashNodeEscrowError::AgentMissing);

        let signer_seeds: &[&[&[u8]]] = &[&[
            b"request",
            request.sender.as_ref(),
            request.reference_seed.as_ref(),
            &[request.bump],
        ]];

        let agent_settlement_units = request
            .amount_units
            .checked_add(request.agent_fee_units)
            .ok_or(CashNodeEscrowError::AmountOverflow)?;

        transfer_from_vault(
            &ctx.accounts.token_program,
            &ctx.accounts.vault_token_account,
            &ctx.accounts.agent_token_account,
            &ctx.accounts.request.to_account_info(),
            signer_seeds,
            agent_settlement_units,
        )?;

        if request.platform_fee_units > 0 {
            transfer_from_vault(
                &ctx.accounts.token_program,
                &ctx.accounts.vault_token_account,
                &ctx.accounts.treasury_token_account,
                &ctx.accounts.request.to_account_info(),
                signer_seeds,
                request.platform_fee_units,
            )?;
        }

        close_vault(
            &ctx.accounts.token_program,
            &ctx.accounts.vault_token_account,
            &ctx.accounts.sender.to_account_info(),
            &ctx.accounts.request.to_account_info(),
            signer_seeds,
        )?;

        Ok(())
    }

    pub fn cancel_request(ctx: Context<CancelRequest>) -> Result<()> {
        let request = &ctx.accounts.request;
        let total_units = request
            .amount_units
            .checked_add(request.agent_fee_units)
            .and_then(|amount| amount.checked_add(request.platform_fee_units))
            .ok_or(CashNodeEscrowError::AmountOverflow)?;
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"request",
            request.sender.as_ref(),
            request.reference_seed.as_ref(),
            &[request.bump],
        ]];

        transfer_from_vault(
            &ctx.accounts.token_program,
            &ctx.accounts.vault_token_account,
            &ctx.accounts.sender_token_account,
            &ctx.accounts.request.to_account_info(),
            signer_seeds,
            total_units,
        )?;

        close_vault(
            &ctx.accounts.token_program,
            &ctx.accounts.vault_token_account,
            &ctx.accounts.sender.to_account_info(),
            &ctx.accounts.request.to_account_info(),
            signer_seeds,
        )?;

        Ok(())
    }
}

fn transfer_from_vault<'info>(
    token_program: &Program<'info, Token>,
    from: &Account<'info, TokenAccount>,
    to: &Account<'info, TokenAccount>,
    authority: &AccountInfo<'info>,
    signer_seeds: &[&[&[u8]]],
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }

    token::transfer(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            Transfer {
                from: from.to_account_info(),
                to: to.to_account_info(),
                authority: authority.clone(),
            },
            signer_seeds,
        ),
        amount,
    )
}

fn close_vault<'info>(
    token_program: &Program<'info, Token>,
    account: &Account<'info, TokenAccount>,
    destination: &AccountInfo<'info>,
    authority: &AccountInfo<'info>,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    token::close_account(CpiContext::new_with_signer(
        token_program.to_account_info(),
        CloseAccount {
            account: account.to_account_info(),
            destination: destination.clone(),
            authority: authority.clone(),
        },
        signer_seeds,
    ))
}

#[derive(Accounts)]
#[instruction(reference_seed: [u8; 32])]
pub struct CreateRequest<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
    #[account(
        init,
        payer = sender,
        space = 8 + RequestEscrow::LEN,
        seeds = [b"request", sender.key().as_ref(), reference_seed.as_ref()],
        bump
    )]
    pub request: Account<'info, RequestEscrow>,
    #[account(
        mut,
        constraint = sender_token_account.owner == sender.key() @ CashNodeEscrowError::InvalidTokenAccount,
        constraint = sender_token_account.mint == token_mint.key() @ CashNodeEscrowError::InvalidTokenAccount
    )]
    pub sender_token_account: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = sender,
        token::mint = token_mint,
        token::authority = request,
        seeds = [b"vault", request.key().as_ref()],
        bump
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    pub token_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AcceptRequest<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,
    #[account(
        mut,
        seeds = [b"request", request.sender.as_ref(), request.reference_seed.as_ref()],
        bump = request.bump
    )]
    pub request: Account<'info, RequestEscrow>,
}

#[derive(Accounts)]
pub struct AgentRequest<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,
    #[account(
        mut,
        seeds = [b"request", request.sender.as_ref(), request.reference_seed.as_ref()],
        bump = request.bump
    )]
    pub request: Account<'info, RequestEscrow>,
}

#[derive(Accounts)]
pub struct CompleteRequest<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
    #[account(
        mut,
        close = sender,
        has_one = sender,
        has_one = vault_token_account,
        seeds = [b"request", sender.key().as_ref(), request.reference_seed.as_ref()],
        bump = request.bump
    )]
    pub request: Account<'info, RequestEscrow>,
    #[account(
        mut,
        seeds = [b"vault", request.key().as_ref()],
        bump = request.vault_bump,
        constraint = vault_token_account.mint == request.token_mint @ CashNodeEscrowError::InvalidTokenAccount,
        constraint = vault_token_account.owner == request.key() @ CashNodeEscrowError::InvalidTokenAccount
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = agent_token_account.owner == request.agent @ CashNodeEscrowError::UnauthorizedAgent,
        constraint = agent_token_account.mint == request.token_mint @ CashNodeEscrowError::InvalidTokenAccount
    )]
    pub agent_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = treasury_token_account.owner == treasury_authority.key() @ CashNodeEscrowError::InvalidTreasury,
        constraint = treasury_token_account.mint == request.token_mint @ CashNodeEscrowError::InvalidTokenAccount
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,
    /// CHECK: Treasury authority is a program-derived address used only as the owner of the treasury token account.
    #[account(seeds = [b"treasury_authority"], bump)]
    pub treasury_authority: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CancelRequest<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
    #[account(
        mut,
        close = sender,
        has_one = sender,
        has_one = vault_token_account,
        constraint = request.status == STATUS_OPEN @ CashNodeEscrowError::InvalidStatus,
        seeds = [b"request", sender.key().as_ref(), request.reference_seed.as_ref()],
        bump = request.bump
    )]
    pub request: Account<'info, RequestEscrow>,
    #[account(
        mut,
        seeds = [b"vault", request.key().as_ref()],
        bump = request.vault_bump,
        constraint = vault_token_account.mint == request.token_mint @ CashNodeEscrowError::InvalidTokenAccount,
        constraint = vault_token_account.owner == request.key() @ CashNodeEscrowError::InvalidTokenAccount
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = sender_token_account.owner == sender.key() @ CashNodeEscrowError::InvalidTokenAccount,
        constraint = sender_token_account.mint == request.token_mint @ CashNodeEscrowError::InvalidTokenAccount
    )]
    pub sender_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct RequestEscrow {
    pub sender: Pubkey,
    pub agent: Pubkey,
    pub token_mint: Pubkey,
    pub vault_token_account: Pubkey,
    pub reference_seed: [u8; 32],
    pub amount_units: u64,
    pub agent_fee_units: u64,
    pub platform_fee_units: u64,
    pub status: u8,
    pub created_at: i64,
    pub accepted_at: i64,
    pub paid_at: i64,
    pub bump: u8,
    pub vault_bump: u8,
}

impl RequestEscrow {
    pub const LEN: usize = 32 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 1 + 8 + 8 + 8 + 1 + 1;
}

#[error_code]
pub enum CashNodeEscrowError {
    #[msg("Amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Amount overflow.")]
    AmountOverflow,
    #[msg("The escrow request is not in the required state.")]
    InvalidStatus,
    #[msg("Only the assigned agent can perform this action.")]
    UnauthorizedAgent,
    #[msg("This request does not have an assigned agent.")]
    AgentMissing,
    #[msg("Token account does not match this escrow.")]
    InvalidTokenAccount,
    #[msg("Treasury token account is not owned by the expected treasury authority.")]
    InvalidTreasury,
}
