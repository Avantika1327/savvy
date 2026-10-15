import type { NextFunction, Request, Response } from 'express';
import { MembershipRole, TenantModule } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export type TenantPermissionAction = 'VIEW' | 'CREATE' | 'EDIT' | 'DELETE';
type PermissionField = 'canView' | 'canCreate' | 'canEdit' | 'canDelete';

const permissionField: Record<TenantPermissionAction, PermissionField> = {
  VIEW: 'canView',
  CREATE: 'canCreate',
  EDIT: 'canEdit',
  DELETE: 'canDelete',
};

/**
 * Fails closed unless the module is enabled for the authenticated tenant and
 * the current membership role has the requested permission. Tenant owners have
 * full permissions only for modules enabled for their tenant.
 *
 * Use after authenticate('web') and requireActiveTenant(). Never rely on the
 * frontend hiding a menu item to enforce access control.
 */
export function requireTenantPermission(module: TenantModule, action: TenantPermissionAction) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = req.auth;
      if (!auth?.tenantId || !auth.tenantRole) {
        return res.status(403).json({
          error: { code: 'TENANT_CONTEXT_REQUIRED', message: 'An active tenant membership is required.' },
        });
      }

      const moduleAccess = await prisma.tenantModuleAccess.findUnique({
        where: { tenantId_module: { tenantId: auth.tenantId, module } },
        select: { isEnabled: true },
      });

      if (!moduleAccess?.isEnabled) {
        return res.status(403).json({
          error: { code: 'TENANT_MODULE_DISABLED', message: 'This module is not enabled for your workspace.' },
        });
      }

      // The owner administers all enabled modules; this does not override disabled module entitlements.
      if (auth.tenantRole === MembershipRole.TENANT_OWNER) return next();

      const permission = await prisma.tenantRolePermission.findUnique({
        where: {
          tenantId_role_module: {
            tenantId: auth.tenantId,
            role: auth.tenantRole,
            module,
          },
        },
        select: { canView: true, canCreate: true, canEdit: true, canDelete: true },
      });

      if (!permission || !permission[permissionField[action]]) {
        return res.status(403).json({
          error: {
            code: 'TENANT_PERMISSION_DENIED',
            message: `Your workspace role does not allow ${action.toLowerCase()} access to this module.`,
          },
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
