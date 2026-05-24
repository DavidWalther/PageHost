const { Logging } = require('../../../../modules/logging.js');
const { DataFacade } = require('../../../../database2/DataFacade.js');
const RefreshTokenService = require('../../../../modules/oAuth2/RefreshTokenService.js');
const AccessTokenService = require('../../../../modules/oAuth2/AccessTokenService.js');
const JwtService = require('../../../../modules/oAuth2/JwtService.js');

class RefreshEndpoint {
  constructor() {
    this.environment = null;
    this.requestObject = null;
    this.responseObject = null;
  }

  setEnvironment(environment) {
    this.environment = environment;
    return this;
  }

  setRequestObject(requestObject) {
    this.requestObject = requestObject;
    return this;
  }

  setResponseObject(responseObject) {
    this.responseObject = responseObject;
    return this;
  }

  async execute() {
    const LOCATION = 'RefreshEndpoint.execute';

    Logging.debugMessage({
      severity: 'INFO',
      message: 'Executing token refresh',
      location: LOCATION,
    });

    const { refresh_token } = this.requestObject.body || {};

    if (!refresh_token) {
      Logging.debugMessage({
        severity: 'INFO',
        message: 'Missing refresh_token in request body',
        location: LOCATION,
      });
      return this.responseObject
        .status(400)
        .json({ error: 'Missing refresh_token' });
    }

    // Validate refresh token JWT
    const refreshPayload = RefreshTokenService.verifyRefreshToken(
      refresh_token,
      this.environment.AUTH_SERVER_SECRET
    );

    if (!refreshPayload) {
      Logging.debugMessage({
        severity: 'INFO',
        message: 'Invalid or expired refresh token',
        location: LOCATION,
      });
      return this.responseObject
        .status(401)
        .json({ error: 'Invalid or expired refresh token' });
    }

    const tokenId = refreshPayload.token;

    // Decode the old access token from authorization header to get user email
    // Or use the token ID to find the identity record
    const dataFacade = new DataFacade(this.environment);

    // Find identity by refresh token UUID
    let identityRecord;
    try {
      identityRecord = await this._findIdentityByRefreshTokenId(
        dataFacade,
        tokenId
      );
    } catch (error) {
      Logging.debugMessage({
        severity: 'ERROR',
        message: `Error querying identity: ${error}`,
        location: LOCATION,
      });
      return this.responseObject
        .status(500)
        .json({ error: 'Internal server error' });
    }

    if (!identityRecord) {
      Logging.debugMessage({
        severity: 'INFO',
        message: 'No identity found for refresh token UUID',
        location: LOCATION,
      });
      return this.responseObject
        .status(401)
        .json({ error: 'Invalid refresh token' });
    }

    // Generate new access token
    const accessTokenService = new AccessTokenService();
    accessTokenService.setEnvironment(this.environment);

    const userInfo = { email: identityRecord.key };
    const scopes = accessTokenService.getUserScopes(identityRecord);

    let newAccessToken;
    try {
      newAccessToken = accessTokenService.createJwt(userInfo, scopes);
    } catch (error) {
      Logging.debugMessage({
        severity: 'ERROR',
        message: `Error creating access token: ${error}`,
        location: LOCATION,
      });
      return this.responseObject
        .status(500)
        .json({ error: 'Internal server error' });
    }

    // Generate new refresh token (rotation)
    const refreshTokenLifetimeDays = parseInt(
      this.environment.AUTH_REFRESH_TOKEN_LIFETIME_DAYS,
      10
    );

    if (
      !this.environment.AUTH_REFRESH_TOKEN_LIFETIME_DAYS ||
      isNaN(refreshTokenLifetimeDays) ||
      refreshTokenLifetimeDays <= 0
    ) {
      Logging.debugMessage({
        severity: 'ERROR',
        message: 'AUTH_REFRESH_TOKEN_LIFETIME_DAYS is not set or invalid',
        location: LOCATION,
      });
      return this.responseObject
        .status(500)
        .json({ error: 'Server configuration error' });
    }

    const newRefreshTokenJwt = RefreshTokenService.createRefreshToken(
      this.environment.AUTH_SERVER_SECRET,
      refreshTokenLifetimeDays
    );

    const newRefreshTokenId = RefreshTokenService.extractTokenId(
      newRefreshTokenJwt,
      this.environment.AUTH_SERVER_SECRET
    );
    const newRefreshPayload = RefreshTokenService.verifyRefreshToken(
      newRefreshTokenJwt,
      this.environment.AUTH_SERVER_SECRET
    );

    // Store new refresh token in DB (rotation)
    try {
      dataFacade.setSkipCache(true);
      await dataFacade.updateData({
        object: 'identity',
        payload: {
          id: identityRecord.id,
          refreshtoken: JSON.stringify({
            token: newRefreshTokenId,
            issuedAt: newRefreshPayload.issuedAt,
            expiresAt: newRefreshPayload.expiresAt,
          }),
        },
      });
    } catch (error) {
      Logging.debugMessage({
        severity: 'ERROR',
        message: `Error storing new refresh token: ${error}`,
        location: LOCATION,
      });
      return this.responseObject
        .status(500)
        .json({ error: 'Internal server error' });
    }

    Logging.debugMessage({
      severity: 'INFO',
      message: 'Token refresh completed successfully',
      location: LOCATION,
    });

    return this.responseObject.json({
      authenticationResult: {
        access: {
          access_token: newAccessToken,
          scopes,
        },
        refresh: {
          refresh_token: newRefreshTokenJwt,
        },
      },
    });
  }

  async _findIdentityByRefreshTokenId(dataFacade, tokenId) {
    const LOCATION = 'RefreshEndpoint._findIdentityByRefreshTokenId';

    // Query identity table - we need to find the record where refreshtoken->token matches
    // Since DataFacade.getData for identity uses key lookup, we use a different approach:
    // We get the identity by checking the stored refresh token UUID
    const dataStorage =
      new (require('../../../../database2/DataStorage/DataStorage.js').DataStorage)(
        this.environment
      );
    dataStorage.setConditionApplicationKey(
      this.environment.APPLICATION_APPLICATION_KEY
    );

    const {
      ActionGet,
    } = require('../../../../database2/DataStorage/actions/get.js');
    const {
      TableIdentity,
    } = require('../../../../database2/tables/identity.js');

    const tableIdentity = new TableIdentity();
    const actionGet = new ActionGet()
      .setPgConnector(dataStorage.pgConnector)
      .setTableName(tableIdentity.tableName)
      .setTableFields(tableIdentity.tableFields)
      .setCustomConditions(`refreshtoken->>'token' = '${tokenId}'`)
      .setCustomConditions(`active = true`)
      .setConditionApplicationKey(this.environment.APPLICATION_APPLICATION_KEY);

    const result = await actionGet.execute();

    if (result.length === 0) {
      Logging.debugMessage({
        severity: 'FINEST',
        location: LOCATION,
        message: `No identity found for refresh token ID: ${tokenId}`,
      });
      return null;
    }

    return result[0];
  }
}

module.exports = RefreshEndpoint;
