/**
 * Murmuration Service
 * CRUD operations for the Murmuration (clan) system.
 *
 * Handles creation, membership, invites, roles, formation XP,
 * challenges, leaderboard, and disbanding of murmurations.
 *
 * All mutations require authentication via getCurrentUser().
 * Atomic numeric operations use supabase .rpc() calls.
 */

import { supabase, getCurrentUser, isAuthenticated } from '@/services/SupabaseClient';
import { MURMURATION } from '@/utils/Constants';
import type {
  Murmuration,
  MurmurationMember,
  MurmurationInvite,
  MurmurationPrivacy,
  MurmurationRole,
  MurmurationChallenge,
  MurmurationLeaderBirdEntry,
  EmblemConfig,
} from '@/types/murmuration';

// ============================================================================
// Filter Types
// ============================================================================

export interface BrowseFilters {
  nameSearch?: string;
  minFormation?: number;
  maxFormation?: number;
  privacy?: MurmurationPrivacy;
  limit?: number;
  offset?: number;
}

export interface MurmurationUpdatePayload {
  name?: string;
  tag?: string;
  description?: string | null;
  privacy?: MurmurationPrivacy;
  emblem_config?: EmblemConfig;
}

// ============================================================================
// Service Class
// ============================================================================

class MurmurationService {
  // --------------------------------------------------------------------------
  // Auth helper
  // --------------------------------------------------------------------------

  /**
   * Require an authenticated user. Throws if not logged in.
   */
  private async requireUser(): Promise<string> {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Authentication required');
    }
    return user.id;
  }

  // --------------------------------------------------------------------------
  // 1. Create Murmuration
  // --------------------------------------------------------------------------

  /**
   * Create a new murmuration.
   * - Validates name length (NAME_MIN..NAME_MAX) and tag length (TAG_MIN..TAG_MAX)
   * - Requires player level >= MIN_LEVEL
   * - Deducts CREATE_COST banked coins
   * - Inserts murmuration row and creator as alpha member
   */
  async createMurmuration(
    name: string,
    tag: string,
    privacy: MurmurationPrivacy,
    description: string | null
  ): Promise<Murmuration> {
    const userId = await this.requireUser();

    // Validate name length
    if (name.length < MURMURATION.NAME_MIN || name.length > MURMURATION.NAME_MAX) {
      throw new Error(
        `Name must be between ${MURMURATION.NAME_MIN} and ${MURMURATION.NAME_MAX} characters`
      );
    }

    // Validate tag length
    if (tag.length < MURMURATION.TAG_MIN || tag.length > MURMURATION.TAG_MAX) {
      throw new Error(
        `Tag must be between ${MURMURATION.TAG_MIN} and ${MURMURATION.TAG_MAX} characters`
      );
    }

    // Validate description length if provided
    if (description && description.length > MURMURATION.DESCRIPTION_MAX) {
      throw new Error(
        `Description must be at most ${MURMURATION.DESCRIPTION_MAX} characters`
      );
    }

    // Check player level
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('level, coins')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error('Failed to fetch player profile');
    }

    if (profile.level < MURMURATION.MIN_LEVEL) {
      throw new Error(`You must be at least level ${MURMURATION.MIN_LEVEL} to create a murmuration`);
    }

    // Check sufficient coins
    if (profile.coins < MURMURATION.CREATE_COST) {
      throw new Error(
        `Creating a murmuration costs ${MURMURATION.CREATE_COST} coins. You have ${profile.coins}`
      );
    }

    // Check player is not already in a murmuration
    const existing = await this.getPlayerMurmuration(userId);
    if (existing) {
      throw new Error('You are already in a murmuration. Leave your current one first');
    }

    // Check cooldown
    const onCooldown = await this.checkCooldown(userId);
    if (onCooldown) {
      throw new Error('You are on a join cooldown. Please wait before creating or joining a murmuration');
    }

    // Deduct coins
    const { error: deductError } = await supabase.rpc('deduct_coins', {
      user_id: userId,
      amount: MURMURATION.CREATE_COST,
    });

    if (deductError) {
      throw new Error('Failed to deduct creation cost');
    }

    // Insert murmuration
    const { data: murmuration, error: insertError } = await supabase
      .from('murmurations')
      .insert({
        name,
        tag: tag.toUpperCase(),
        description,
        privacy,
        alpha_id: userId,
        formation_level: 1,
        formation_xp: 0,
        member_count: 1,
        total_coins_banked: 0,
        season_coins_banked: 0,
        mvm_wins: 0,
        mvm_losses: 0,
      })
      .select()
      .single();

    if (insertError || !murmuration) {
      // Attempt to refund coins on failure
      await supabase.rpc('add_coins', { user_id: userId, amount: MURMURATION.CREATE_COST });
      throw new Error(`Failed to create murmuration: ${insertError?.message}`);
    }

    // Insert creator as alpha member
    const { error: memberError } = await supabase
      .from('murmuration_members')
      .insert({
        murmuration_id: murmuration.id,
        user_id: userId,
        role: 'alpha' as MurmurationRole,
        coins_contributed: 0,
        formation_xp_contributed: 0,
      });

    if (memberError) {
      // Rollback: delete murmuration and refund
      await supabase.from('murmurations').delete().eq('id', murmuration.id);
      await supabase.rpc('add_coins', { user_id: userId, amount: MURMURATION.CREATE_COST });
      throw new Error(`Failed to add creator as member: ${memberError.message}`);
    }

    return murmuration as Murmuration;
  }

  // --------------------------------------------------------------------------
  // 2. Get Murmuration
  // --------------------------------------------------------------------------

  /**
   * Fetch a murmuration by ID.
   */
  async getMurmuration(id: string): Promise<Murmuration | null> {
    const { data, error } = await supabase
      .from('murmurations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Failed to fetch murmuration:', error);
      return null;
    }

    return data as Murmuration;
  }

  // --------------------------------------------------------------------------
  // 3. Get Player's Murmuration
  // --------------------------------------------------------------------------

  /**
   * Get the murmuration a player currently belongs to.
   * Joins murmuration_members with murmurations.
   */
  async getPlayerMurmuration(userId: string): Promise<Murmuration | null> {
    const { data, error } = await supabase
      .from('murmuration_members')
      .select('murmuration_id, murmurations(*)')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // Not an error if the player simply is not in a murmuration
      return null;
    }

    return (data as any).murmurations as Murmuration;
  }

  // --------------------------------------------------------------------------
  // 4. Browse Murmurations
  // --------------------------------------------------------------------------

  /**
   * Search and filter murmurations with pagination.
   */
  async browseMurmurations(
    filters?: BrowseFilters
  ): Promise<{ data: Murmuration[]; count: number }> {
    const limit = filters?.limit ?? 20;
    const offset = filters?.offset ?? 0;

    let query = supabase
      .from('murmurations')
      .select('*', { count: 'exact' });

    // Name search (case-insensitive partial match)
    if (filters?.nameSearch) {
      query = query.ilike('name', `%${filters.nameSearch}%`);
    }

    // Formation level range
    if (filters?.minFormation !== undefined) {
      query = query.gte('formation_level', filters.minFormation);
    }
    if (filters?.maxFormation !== undefined) {
      query = query.lte('formation_level', filters.maxFormation);
    }

    // Privacy filter
    if (filters?.privacy) {
      query = query.eq('privacy', filters.privacy);
    }

    // Pagination & ordering
    query = query
      .order('member_count', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to browse murmurations: ${error.message}`);
    }

    return {
      data: (data || []) as Murmuration[],
      count: count ?? 0,
    };
  }

  // --------------------------------------------------------------------------
  // 5. Join Murmuration
  // --------------------------------------------------------------------------

  /**
   * Join an open murmuration.
   * - Checks join cooldown
   * - Only open murmurations can be joined directly
   * - Checks member cap (formation-level-dependent)
   */
  async joinMurmuration(murmurationId: string): Promise<MurmurationMember> {
    const userId = await this.requireUser();

    // Check cooldown
    const onCooldown = await this.checkCooldown(userId);
    if (onCooldown) {
      throw new Error('You are on a join cooldown. Please wait before joining a murmuration');
    }

    // Check not already in a murmuration
    const existing = await this.getPlayerMurmuration(userId);
    if (existing) {
      throw new Error('You are already in a murmuration. Leave your current one first');
    }

    // Fetch target murmuration
    const murmuration = await this.getMurmuration(murmurationId);
    if (!murmuration) {
      throw new Error('Murmuration not found');
    }

    // Only open murmurations allow direct join
    if (murmuration.privacy !== 'open') {
      throw new Error('This murmuration is not open for direct joining. Request an invite instead');
    }

    // Check member cap
    const maxMembers = murmuration.formation_level >= 7
      ? MURMURATION.MAX_MEMBERS_F7
      : MURMURATION.MAX_MEMBERS;

    if (murmuration.member_count >= maxMembers) {
      throw new Error('This murmuration is full');
    }

    // Insert member
    const { data: member, error: memberError } = await supabase
      .from('murmuration_members')
      .insert({
        murmuration_id: murmurationId,
        user_id: userId,
        role: 'fledgling' as MurmurationRole,
        coins_contributed: 0,
        formation_xp_contributed: 0,
      })
      .select()
      .single();

    if (memberError) {
      throw new Error(`Failed to join murmuration: ${memberError.message}`);
    }

    // Increment member_count atomically
    const { error: countError } = await supabase.rpc('increment_member_count', {
      mur_id: murmurationId,
      amount: 1,
    });

    if (countError) {
      console.error('Failed to increment member count:', countError);
    }

    return member as MurmurationMember;
  }

  // --------------------------------------------------------------------------
  // 6. Leave Murmuration
  // --------------------------------------------------------------------------

  /**
   * Leave the current murmuration.
   * - If alpha, triggers succession (promote oldest sentinel, else oldest fledgling)
   * - Sets join cooldown
   * - Decrements member_count
   */
  async leaveMurmuration(): Promise<void> {
    const userId = await this.requireUser();

    // Find current membership
    const { data: membership, error: memberError } = await supabase
      .from('murmuration_members')
      .select('id, murmuration_id, role')
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      throw new Error('You are not in a murmuration');
    }

    const murmurationId = membership.murmuration_id;

    // Handle alpha succession if the leaving player is alpha
    if (membership.role === 'alpha') {
      await this.handleAlphaSuccession(murmurationId, userId);
    }

    // Remove member
    const { error: deleteError } = await supabase
      .from('murmuration_members')
      .delete()
      .eq('user_id', userId)
      .eq('murmuration_id', murmurationId);

    if (deleteError) {
      throw new Error(`Failed to leave murmuration: ${deleteError.message}`);
    }

    // Decrement member_count atomically
    const { error: countError } = await supabase.rpc('increment_member_count', {
      mur_id: murmurationId,
      amount: -1,
    });

    if (countError) {
      console.error('Failed to decrement member count:', countError);
    }

    // Check if murmuration is now empty and should be auto-disbanded
    const murmuration = await this.getMurmuration(murmurationId);
    if (murmuration && murmuration.member_count <= 0) {
      await supabase.from('murmurations').delete().eq('id', murmurationId);
      return;
    }

    // Set join cooldown for the leaving player
    await this.setCooldown(userId);
  }

  /**
   * Handle alpha succession when the alpha leaves.
   * Priority: oldest sentinel, then oldest fledgling.
   * If no members remain, the murmuration will be auto-disbanded in leaveMurmuration.
   */
  private async handleAlphaSuccession(
    murmurationId: string,
    leavingUserId: string
  ): Promise<void> {
    // Try to find a sentinel first, then any fledgling
    const { data: successor } = await supabase
      .from('murmuration_members')
      .select('user_id, role')
      .eq('murmuration_id', murmurationId)
      .neq('user_id', leavingUserId)
      .order('role', { ascending: true }) // 'alpha' < 'fledgling' < 'sentinel' — we want sentinel first
      .order('joined_at', { ascending: true })
      .limit(1)
      .single();

    if (!successor) {
      // No one left to promote; murmuration will be disbanded
      return;
    }

    // Promote the successor to alpha
    await supabase
      .from('murmuration_members')
      .update({ role: 'alpha' })
      .eq('user_id', successor.user_id)
      .eq('murmuration_id', murmurationId);

    // Update murmuration alpha_id
    await supabase
      .from('murmurations')
      .update({ alpha_id: successor.user_id })
      .eq('id', murmurationId);
  }

  // --------------------------------------------------------------------------
  // 7. Kick Member
  // --------------------------------------------------------------------------

  /**
   * Kick a member from the murmuration.
   * - Alpha can kick anyone (sentinel or fledgling)
   * - Sentinel can kick fledglings only
   * - Sets cooldown for the kicked player
   */
  async kickMember(userId: string, murmurationId: string): Promise<void> {
    const currentUserId = await this.requireUser();

    // Get kicker's membership
    const { data: kickerMembership, error: kickerError } = await supabase
      .from('murmuration_members')
      .select('role')
      .eq('user_id', currentUserId)
      .eq('murmuration_id', murmurationId)
      .single();

    if (kickerError || !kickerMembership) {
      throw new Error('You are not a member of this murmuration');
    }

    // Get target's membership
    const { data: targetMembership, error: targetError } = await supabase
      .from('murmuration_members')
      .select('role')
      .eq('user_id', userId)
      .eq('murmuration_id', murmurationId)
      .single();

    if (targetError || !targetMembership) {
      throw new Error('Target player is not a member of this murmuration');
    }

    // Cannot kick yourself
    if (userId === currentUserId) {
      throw new Error('You cannot kick yourself. Use leave instead');
    }

    // Permission checks
    const kickerRole = kickerMembership.role as MurmurationRole;
    const targetRole = targetMembership.role as MurmurationRole;

    if (kickerRole === 'fledgling') {
      throw new Error('Fledglings cannot kick members');
    }

    if (kickerRole === 'sentinel' && targetRole !== 'fledgling') {
      throw new Error('Sentinels can only kick fledglings');
    }

    if (targetRole === 'alpha') {
      throw new Error('Cannot kick the alpha');
    }

    // Remove the member
    const { error: deleteError } = await supabase
      .from('murmuration_members')
      .delete()
      .eq('user_id', userId)
      .eq('murmuration_id', murmurationId);

    if (deleteError) {
      throw new Error(`Failed to kick member: ${deleteError.message}`);
    }

    // Decrement member_count
    const { error: countError } = await supabase.rpc('increment_member_count', {
      mur_id: murmurationId,
      amount: -1,
    });

    if (countError) {
      console.error('Failed to decrement member count:', countError);
    }

    // Set cooldown for kicked player
    await this.setCooldown(userId);
  }

  // --------------------------------------------------------------------------
  // 8. Invite Player
  // --------------------------------------------------------------------------

  /**
   * Invite a player to the murmuration.
   * Creates an invite record with pending status.
   */
  async invitePlayer(userId: string, murmurationId: string): Promise<MurmurationInvite> {
    const currentUserId = await this.requireUser();

    // Verify inviter is a member of the murmuration
    const { data: membership, error: memberError } = await supabase
      .from('murmuration_members')
      .select('role')
      .eq('user_id', currentUserId)
      .eq('murmuration_id', murmurationId)
      .single();

    if (memberError || !membership) {
      throw new Error('You are not a member of this murmuration');
    }

    // Only alpha and sentinels can invite
    if (membership.role === 'fledgling') {
      throw new Error('Fledglings cannot invite players');
    }

    // Check target is not already in a murmuration
    const existingMurmuration = await this.getPlayerMurmuration(userId);
    if (existingMurmuration) {
      throw new Error('Target player is already in a murmuration');
    }

    // Check no existing pending invite for this user + murmuration
    const { data: existingInvite } = await supabase
      .from('murmuration_invites')
      .select('id')
      .eq('invited_user_id', userId)
      .eq('murmuration_id', murmurationId)
      .eq('status', 'pending')
      .single();

    if (existingInvite) {
      throw new Error('An invite is already pending for this player');
    }

    // Create invite
    const { data: invite, error: inviteError } = await supabase
      .from('murmuration_invites')
      .insert({
        murmuration_id: murmurationId,
        invited_user_id: userId,
        invited_by: currentUserId,
        status: 'pending',
      })
      .select()
      .single();

    if (inviteError || !invite) {
      throw new Error(`Failed to create invite: ${inviteError?.message}`);
    }

    return invite as MurmurationInvite;
  }

  // --------------------------------------------------------------------------
  // 9. Accept Invite
  // --------------------------------------------------------------------------

  /**
   * Accept a pending invite. Updates status and adds the user as a fledgling member.
   */
  async acceptInvite(inviteId: string): Promise<MurmurationMember> {
    const userId = await this.requireUser();

    // Fetch invite
    const { data: invite, error: inviteError } = await supabase
      .from('murmuration_invites')
      .select('*')
      .eq('id', inviteId)
      .eq('invited_user_id', userId)
      .eq('status', 'pending')
      .single();

    if (inviteError || !invite) {
      throw new Error('Invite not found or already resolved');
    }

    // Check invite has not expired
    const createdAt = new Date(invite.created_at).getTime();
    if (Date.now() - createdAt > MURMURATION.INVITE_TTL_MS) {
      // Mark as expired
      await supabase
        .from('murmuration_invites')
        .update({ status: 'expired' })
        .eq('id', inviteId);
      throw new Error('This invite has expired');
    }

    // Check cooldown
    const onCooldown = await this.checkCooldown(userId);
    if (onCooldown) {
      throw new Error('You are on a join cooldown. Please wait before joining a murmuration');
    }

    // Check not already in a murmuration
    const existing = await this.getPlayerMurmuration(userId);
    if (existing) {
      throw new Error('You are already in a murmuration');
    }

    // Check member cap
    const murmuration = await this.getMurmuration(invite.murmuration_id);
    if (!murmuration) {
      throw new Error('Murmuration no longer exists');
    }

    const maxMembers = murmuration.formation_level >= 7
      ? MURMURATION.MAX_MEMBERS_F7
      : MURMURATION.MAX_MEMBERS;

    if (murmuration.member_count >= maxMembers) {
      throw new Error('This murmuration is full');
    }

    // Update invite status
    const { error: updateError } = await supabase
      .from('murmuration_invites')
      .update({ status: 'accepted' })
      .eq('id', inviteId);

    if (updateError) {
      throw new Error(`Failed to update invite: ${updateError.message}`);
    }

    // Add member
    const { data: member, error: memberError } = await supabase
      .from('murmuration_members')
      .insert({
        murmuration_id: invite.murmuration_id,
        user_id: userId,
        role: 'fledgling' as MurmurationRole,
        coins_contributed: 0,
        formation_xp_contributed: 0,
      })
      .select()
      .single();

    if (memberError) {
      throw new Error(`Failed to add member: ${memberError.message}`);
    }

    // Increment member_count
    const { error: countError } = await supabase.rpc('increment_member_count', {
      mur_id: invite.murmuration_id,
      amount: 1,
    });

    if (countError) {
      console.error('Failed to increment member count:', countError);
    }

    // Decline any other pending invites for this user
    await supabase
      .from('murmuration_invites')
      .update({ status: 'declined' })
      .eq('invited_user_id', userId)
      .eq('status', 'pending')
      .neq('id', inviteId);

    return member as MurmurationMember;
  }

  // --------------------------------------------------------------------------
  // 10. Decline Invite
  // --------------------------------------------------------------------------

  /**
   * Decline a pending invite.
   */
  async declineInvite(inviteId: string): Promise<void> {
    const userId = await this.requireUser();

    const { error } = await supabase
      .from('murmuration_invites')
      .update({ status: 'declined' })
      .eq('id', inviteId)
      .eq('invited_user_id', userId)
      .eq('status', 'pending');

    if (error) {
      throw new Error(`Failed to decline invite: ${error.message}`);
    }
  }

  // --------------------------------------------------------------------------
  // 11. Get Pending Invites
  // --------------------------------------------------------------------------

  /**
   * Get all pending invites for a user, joined with murmuration name/tag
   * and inviter username.
   */
  async getPendingInvites(userId: string): Promise<MurmurationInvite[]> {
    const { data, error } = await supabase
      .from('murmuration_invites')
      .select(`
        *,
        murmurations ( name, tag ),
        profiles!murmuration_invites_invited_by_fkey ( username )
      `)
      .eq('invited_user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch pending invites: ${error.message}`);
    }

    // Map joined data into flat shape
    return (data || []).map((row: any) => ({
      id: row.id,
      murmuration_id: row.murmuration_id,
      invited_user_id: row.invited_user_id,
      invited_by: row.invited_by,
      status: row.status,
      created_at: row.created_at,
      murmuration_name: row.murmurations?.name ?? undefined,
      murmuration_tag: row.murmurations?.tag ?? undefined,
      inviter_username: row.profiles?.username ?? undefined,
    })) as MurmurationInvite[];
  }

  // --------------------------------------------------------------------------
  // 12. Promote / Demote (Set Member Role)
  // --------------------------------------------------------------------------

  /**
   * Set a member's role. Only the alpha can promote or demote members.
   */
  async setMemberRole(
    userId: string,
    murmurationId: string,
    role: MurmurationRole
  ): Promise<void> {
    const currentUserId = await this.requireUser();

    // Only alpha can change roles
    const murmuration = await this.getMurmuration(murmurationId);
    if (!murmuration) {
      throw new Error('Murmuration not found');
    }

    if (murmuration.alpha_id !== currentUserId) {
      throw new Error('Only the alpha can change member roles');
    }

    // Cannot change own role through this method
    if (userId === currentUserId) {
      throw new Error('Cannot change your own role. Use transferAlpha instead');
    }

    // Cannot promote someone to alpha through this method
    if (role === 'alpha') {
      throw new Error('Use transferAlpha to make someone the new alpha');
    }

    // Verify target is a member
    const { data: membership, error: memberError } = await supabase
      .from('murmuration_members')
      .select('id')
      .eq('user_id', userId)
      .eq('murmuration_id', murmurationId)
      .single();

    if (memberError || !membership) {
      throw new Error('Target player is not a member of this murmuration');
    }

    // Update role
    const { error: updateError } = await supabase
      .from('murmuration_members')
      .update({ role })
      .eq('user_id', userId)
      .eq('murmuration_id', murmurationId);

    if (updateError) {
      throw new Error(`Failed to update member role: ${updateError.message}`);
    }
  }

  // --------------------------------------------------------------------------
  // 13. Transfer Alpha
  // --------------------------------------------------------------------------

  /**
   * Transfer the alpha role to another member.
   * Current alpha becomes sentinel.
   */
  async transferAlpha(newAlphaId: string, murmurationId: string): Promise<void> {
    const currentUserId = await this.requireUser();

    // Verify current user is alpha
    const murmuration = await this.getMurmuration(murmurationId);
    if (!murmuration) {
      throw new Error('Murmuration not found');
    }

    if (murmuration.alpha_id !== currentUserId) {
      throw new Error('Only the alpha can transfer leadership');
    }

    if (newAlphaId === currentUserId) {
      throw new Error('You are already the alpha');
    }

    // Verify new alpha is a member
    const { data: newAlphaMembership, error: memberError } = await supabase
      .from('murmuration_members')
      .select('id')
      .eq('user_id', newAlphaId)
      .eq('murmuration_id', murmurationId)
      .single();

    if (memberError || !newAlphaMembership) {
      throw new Error('Target player is not a member of this murmuration');
    }

    // Promote new alpha
    const { error: promoteError } = await supabase
      .from('murmuration_members')
      .update({ role: 'alpha' })
      .eq('user_id', newAlphaId)
      .eq('murmuration_id', murmurationId);

    if (promoteError) {
      throw new Error(`Failed to promote new alpha: ${promoteError.message}`);
    }

    // Demote current alpha to sentinel
    const { error: demoteError } = await supabase
      .from('murmuration_members')
      .update({ role: 'sentinel' })
      .eq('user_id', currentUserId)
      .eq('murmuration_id', murmurationId);

    if (demoteError) {
      throw new Error(`Failed to demote current alpha: ${demoteError.message}`);
    }

    // Update murmuration alpha_id
    const { error: updateError } = await supabase
      .from('murmurations')
      .update({ alpha_id: newAlphaId })
      .eq('id', murmurationId);

    if (updateError) {
      throw new Error(`Failed to update murmuration alpha: ${updateError.message}`);
    }
  }

  // --------------------------------------------------------------------------
  // 14. Update Murmuration
  // --------------------------------------------------------------------------

  /**
   * Update murmuration settings (name, tag, description, privacy, emblem_config).
   * Only the alpha can update.
   */
  async updateMurmuration(
    id: string,
    updates: MurmurationUpdatePayload
  ): Promise<Murmuration> {
    const currentUserId = await this.requireUser();

    // Verify alpha
    const murmuration = await this.getMurmuration(id);
    if (!murmuration) {
      throw new Error('Murmuration not found');
    }

    if (murmuration.alpha_id !== currentUserId) {
      throw new Error('Only the alpha can update murmuration settings');
    }

    // Validate name if provided
    if (updates.name !== undefined) {
      if (updates.name.length < MURMURATION.NAME_MIN || updates.name.length > MURMURATION.NAME_MAX) {
        throw new Error(
          `Name must be between ${MURMURATION.NAME_MIN} and ${MURMURATION.NAME_MAX} characters`
        );
      }
    }

    // Validate tag if provided
    if (updates.tag !== undefined) {
      if (updates.tag.length < MURMURATION.TAG_MIN || updates.tag.length > MURMURATION.TAG_MAX) {
        throw new Error(
          `Tag must be between ${MURMURATION.TAG_MIN} and ${MURMURATION.TAG_MAX} characters`
        );
      }
      updates.tag = updates.tag.toUpperCase();
    }

    // Validate description if provided
    if (updates.description !== undefined && updates.description !== null) {
      if (updates.description.length > MURMURATION.DESCRIPTION_MAX) {
        throw new Error(
          `Description must be at most ${MURMURATION.DESCRIPTION_MAX} characters`
        );
      }
    }

    const { data: updated, error } = await supabase
      .from('murmurations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update murmuration: ${error.message}`);
    }

    return updated as Murmuration;
  }

  // --------------------------------------------------------------------------
  // 15. Disband Murmuration
  // --------------------------------------------------------------------------

  /**
   * Disband a murmuration. Alpha-only. Deletes the murmuration (cascade
   * deletes members, invites, challenges, etc.).
   */
  async disbandMurmuration(murmurationId: string): Promise<void> {
    const currentUserId = await this.requireUser();

    // Verify alpha
    const murmuration = await this.getMurmuration(murmurationId);
    if (!murmuration) {
      throw new Error('Murmuration not found');
    }

    if (murmuration.alpha_id !== currentUserId) {
      throw new Error('Only the alpha can disband the murmuration');
    }

    // Delete murmuration (cascade handles members, invites, challenges)
    const { error } = await supabase
      .from('murmurations')
      .delete()
      .eq('id', murmurationId);

    if (error) {
      throw new Error(`Failed to disband murmuration: ${error.message}`);
    }
  }

  // --------------------------------------------------------------------------
  // 16. Add Formation XP
  // --------------------------------------------------------------------------

  /**
   * Add formation XP to a murmuration atomically.
   * Checks if the XP crosses a formation level threshold and levels up if so.
   * Optionally tracks which user contributed the XP.
   */
  async addFormationXP(
    murmurationId: string,
    amount: number,
    userId?: string
  ): Promise<{ newXP: number; newLevel: number; leveledUp: boolean }> {
    if (amount <= 0) {
      throw new Error('XP amount must be positive');
    }

    // Atomically increment formation_xp via RPC
    const { data: rpcResult, error: rpcError } = await supabase.rpc('increment_formation_xp', {
      mur_id: murmurationId,
      amount,
    });

    if (rpcError) {
      throw new Error(`Failed to add formation XP: ${rpcError.message}`);
    }

    // Fetch updated murmuration to check level-up
    const { data: murmuration, error: fetchError } = await supabase
      .from('murmurations')
      .select('formation_xp, formation_level')
      .eq('id', murmurationId)
      .single();

    if (fetchError || !murmuration) {
      throw new Error('Failed to fetch murmuration after XP update');
    }

    const currentXP = murmuration.formation_xp;
    const currentLevel = murmuration.formation_level;
    const thresholds = MURMURATION.FORMATION_XP_THRESHOLDS;

    // Calculate what level should be based on current XP
    let newLevel = currentLevel;
    for (let i = currentLevel; i < thresholds.length; i++) {
      if (currentXP >= thresholds[i]) {
        newLevel = i + 1; // Formation levels are 1-indexed (index 0 = Formation 1)
      } else {
        break;
      }
    }

    // Cap at max formation level
    if (newLevel > thresholds.length) {
      newLevel = thresholds.length;
    }

    const leveledUp = newLevel > currentLevel;

    // Update formation level if it changed
    if (leveledUp) {
      const { error: levelError } = await supabase
        .from('murmurations')
        .update({ formation_level: newLevel })
        .eq('id', murmurationId);

      if (levelError) {
        console.error('Failed to update formation level:', levelError);
      }
    }

    // Track contributor XP if userId provided
    if (userId) {
      const { error: contribError } = await supabase.rpc('increment_member_formation_xp', {
        mur_id: murmurationId,
        member_user_id: userId,
        amount,
      });

      if (contribError) {
        console.error('Failed to update member formation XP contribution:', contribError);
      }
    }

    return {
      newXP: currentXP,
      newLevel,
      leveledUp,
    };
  }

  // --------------------------------------------------------------------------
  // 17. Get Members
  // --------------------------------------------------------------------------

  /**
   * Get all members of a murmuration with profile data (username, level).
   */
  async getMembers(murmurationId: string): Promise<MurmurationMember[]> {
    const { data, error } = await supabase
      .from('murmuration_members')
      .select(`
        *,
        profiles ( username, level )
      `)
      .eq('murmuration_id', murmurationId)
      .order('role', { ascending: true })
      .order('joined_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch members: ${error.message}`);
    }

    // Flatten joined profile data
    return (data || []).map((row: any) => ({
      id: row.id,
      murmuration_id: row.murmuration_id,
      user_id: row.user_id,
      role: row.role,
      joined_at: row.joined_at,
      coins_contributed: row.coins_contributed,
      formation_xp_contributed: row.formation_xp_contributed,
      username: row.profiles?.username ?? undefined,
      level: row.profiles?.level ?? undefined,
    })) as MurmurationMember[];
  }

  // --------------------------------------------------------------------------
  // 18. Get Leaderboard
  // --------------------------------------------------------------------------

  /**
   * Get the murmuration leaderboard ordered by season_coins_banked.
   */
  async getMurmurationLeaderboard(
    limit: number = 50,
    offset: number = 0
  ): Promise<MurmurationLeaderBirdEntry[]> {
    const { data, error } = await supabase
      .from('murmurations')
      .select('id, name, tag, emblem_config, formation_level, member_count, season_coins_banked, mvm_wins')
      .order('season_coins_banked', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch LeaderBird: ${error.message}`);
    }

    return (data || []) as MurmurationLeaderBirdEntry[];
  }

  // --------------------------------------------------------------------------
  // 19. Get Challenges
  // --------------------------------------------------------------------------

  /**
   * Get active challenges for a murmuration.
   */
  async getChallenges(murmurationId: string): Promise<MurmurationChallenge[]> {
    const { data, error } = await supabase
      .from('murmuration_challenges')
      .select('*')
      .eq('murmuration_id', murmurationId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch challenges: ${error.message}`);
    }

    return (data || []) as MurmurationChallenge[];
  }

  // --------------------------------------------------------------------------
  // 20. Update Challenge Progress
  // --------------------------------------------------------------------------

  /**
   * Update progress on a murmuration challenge.
   * Increments the total progress and records the user's contribution.
   * If the objective target is reached, marks the challenge as completed.
   */
  async updateChallengeProgress(
    challengeId: string,
    userId: string,
    amount: number
  ): Promise<MurmurationChallenge> {
    if (amount <= 0) {
      throw new Error('Progress amount must be positive');
    }

    // Fetch current challenge
    const { data: challenge, error: fetchError } = await supabase
      .from('murmuration_challenges')
      .select('*')
      .eq('id', challengeId)
      .single();

    if (fetchError || !challenge) {
      throw new Error('Challenge not found');
    }

    if (challenge.status !== 'active') {
      throw new Error('Challenge is not active');
    }

    // Check expiry
    if (challenge.expires_at && new Date(challenge.expires_at).getTime() < Date.now()) {
      await supabase
        .from('murmuration_challenges')
        .update({ status: 'expired' })
        .eq('id', challengeId);
      throw new Error('Challenge has expired');
    }

    // Build updated progress
    const progress = challenge.progress as any;
    const newTotal = (progress.total || 0) + amount;

    // Update or add user contribution
    const contributions = progress.contributions || [];
    const existingContrib = contributions.find((c: any) => c.user_id === userId);
    if (existingContrib) {
      existingContrib.amount += amount;
    } else {
      contributions.push({ user_id: userId, amount });
    }

    const updatedProgress = {
      total: newTotal,
      contributions,
    };

    // Determine if objective is met
    const objective = challenge.objective as any;
    const isCompleted = newTotal >= objective.target;

    // Also update the objective's current value for display
    const updatedObjective = {
      ...objective,
      current: Math.min(newTotal, objective.target),
    };

    const { data: updated, error: updateError } = await supabase
      .from('murmuration_challenges')
      .update({
        progress: updatedProgress,
        objective: updatedObjective,
        status: isCompleted ? 'completed' : 'active',
      })
      .eq('id', challengeId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update challenge progress: ${updateError.message}`);
    }

    return updated as MurmurationChallenge;
  }

  // --------------------------------------------------------------------------
  // 21. Check Cooldown
  // --------------------------------------------------------------------------

  /**
   * Check if a player is on a murmuration join cooldown.
   * Returns true if still on cooldown, false otherwise.
   */
  async checkCooldown(userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('murmuration_cooldowns')
      .select('cooldown_expires_at')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // No cooldown record means not on cooldown
      return false;
    }

    const expiresAt = new Date(data.cooldown_expires_at).getTime();
    if (Date.now() >= expiresAt) {
      // Cooldown has expired — clean it up
      await supabase
        .from('murmuration_cooldowns')
        .delete()
        .eq('user_id', userId);
      return false;
    }

    return true;
  }

  /**
   * Set a join cooldown for a player (24 hours from now).
   */
  private async setCooldown(userId: string): Promise<void> {
    const expiresAt = new Date(Date.now() + MURMURATION.COOLDOWN_MS).toISOString();

    // Upsert cooldown record
    const { error } = await supabase
      .from('murmuration_cooldowns')
      .upsert(
        {
          user_id: userId,
          cooldown_expires_at: expiresAt,
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('Failed to set cooldown:', error);
    }
  }

  // --------------------------------------------------------------------------
  // 22. Add Coins Contribution
  // --------------------------------------------------------------------------

  /**
   * Record a coins contribution to the murmuration.
   * Atomically increments both the murmuration's season_coins_banked and
   * the member's coins_contributed.
   */
  async addCoinsContribution(
    murmurationId: string,
    userId: string,
    coins: number
  ): Promise<void> {
    if (coins <= 0) {
      throw new Error('Coins amount must be positive');
    }

    // Increment murmuration season_coins_banked atomically
    const { error: murError } = await supabase.rpc('increment_season_coins', {
      mur_id: murmurationId,
      amount: coins,
    });

    if (murError) {
      throw new Error(`Failed to update murmuration coins: ${murError.message}`);
    }

    // Increment member coins_contributed atomically
    const { error: memberError } = await supabase.rpc('increment_member_coins', {
      mur_id: murmurationId,
      member_user_id: userId,
      amount: coins,
    });

    if (memberError) {
      console.error('Failed to update member coins contribution:', memberError);
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const murmurationService = new MurmurationService();
