import request from 'supertest';
import express from 'express';
import passport from 'passport';
import { AuthPluginConfig } from '@magda/authentication-plugin-sdk';
import createAuthPluginRouter from '../createAuthPluginRouter.js';
import { expect } from 'chai';
import sinon from 'sinon';
import bcrypt from 'bcrypt';
import session from 'express-session';
import { URL } from 'url';

// Helper function to check failure redirects
function expectFailureRedirect(response: any, expectedErrorMessage: string) {
    expect(response.header.location).to.include('http://localhost:6100/sign-in-redirect?result=failure');
    const url = new URL(response.header.location);
    expect(url.searchParams.get('errorMessage')).to.include(expectedErrorMessage);
}

// Shared session configuration for tests
const testSessionConfig = {
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Disable secure cookies for tests
};

describe('Authentication Plugin Tests', () => {
    let app: express.Application;
    const sandbox = sinon.createSandbox();
    const mockConfig: AuthPluginConfig = {
        key: 'internal',
        name: 'MAGDA',
        iconUrl: '/icon.svg',
        authenticationMethod: 'PASSWORD',
        loginFormUsernameFieldLabel: 'Email Address',
        loginFormPasswordFieldLabel: 'Password',
        loginFormExtraInfoHeading: 'Forgot your password?',
        loginFormExtraInfoContent: 'Forgot your password? Email system admin.'
    };

    beforeEach(() => {
        // Mock database pool
        const mockPool = {
            query: sandbox.stub().resolves({ rows: [] }),
            end: sandbox.stub().resolves()
        };

        app = express();
        app.use(express.urlencoded({ extended: true }));
        
        // Use in-memory session middleware for tests
        app.use(session(testSessionConfig));
        
        // Mock passport
        app.use(passport.initialize());
        app.use(passport.session());

        // Setup passport serialization
        passport.serializeUser((user: any, done) => {
            done(null, user);
        });
        passport.deserializeUser((user: any, done) => {
            done(null, user);
        });

        // Mock config endpoint
        app.get('/config', (req, res) => {
            res.json(mockConfig);
        });

        // Setup auth plugin router
        app.use(
            createAuthPluginRouter({
                passport: passport as any,
                dbPool: mockPool as any,
                externalUrl: 'http://localhost:6100',
                authPluginRedirectUrl: '/sign-in-redirect'
            })
        );
    });

    afterEach(() => {
        // Restore all stubs
        sandbox.restore();
    });

    describe('Config Endpoint', () => {
        it('should return the correct plugin configuration', async () => {
            const response = await request(app)
                .get('/config')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).to.deep.equal(mockConfig);
        });
    });

    describe('Authentication Flow', () => {
        it('should handle successful login with valid credentials', async () => {
            // Use a consistent username and password
            const testUsername = 'test@example.com';
            const testPassword = 'valid-password';
            const testUserId = 'test-user-id';
            const hashedPassword = await bcrypt.hash(testPassword, 12);

            // Mock database query for successful login
            const mockPool = {
                query: sandbox.stub().callsFake((sql, params) => {
                    // Ensure the query is for the correct username and source
                    if (
                        params &&
                        params[0] === testUsername
                    ) {
                        return Promise.resolve({
                            rows: [{
                                user_id: testUserId,
                                hash: hashedPassword
                            }]
                        });
                    }
                    return Promise.resolve({ rows: [] });
                }),
                end: sandbox.stub().resolves()
            };

            // Create a new app instance with the successful login pool
            const successApp = express();
            successApp.use(express.urlencoded({ extended: true }));
            successApp.use(session(testSessionConfig));
            successApp.use(passport.initialize());
            successApp.use(passport.session());

            // Setup passport serialization
            passport.serializeUser((user: any, done) => {
                done(null, user);
            });
            passport.deserializeUser((user: any, done) => {
                done(null, user);
            });

            successApp.get('/config', (req, res) => res.json(mockConfig));
            successApp.use(
                createAuthPluginRouter({
                    passport: passport as any,
                    dbPool: mockPool as any,
                    externalUrl: 'http://localhost:6100',
                    authPluginRedirectUrl: '/sign-in-redirect'
                })
            );

            const response = await request(successApp)
                .post('/')
                .type('form')
                .send({
                    username: testUsername,
                    password: testPassword
                })
                .expect(302);

            // Print the actual redirect URL for debugging
            // eslint-disable-next-line no-console
            console.log('Actual redirect URL:', response.header.location);
            // eslint-disable-next-line no-console
            console.log('POST body:', { username: testUsername, password: testPassword });

            expect(response.header.location).to.include('http://localhost:6100/sign-in-redirect?result=success');
        });

        it('should handle successful login with different salt rounds', async function() {
            // Increase timeout for this test since bcrypt is CPU intensive
            this.timeout(10000);

            const testUsername = 'test@example.com';
            const testPassword = 'valid-password';
            const testUserId = 'test-user-id';

            // Test with different salt rounds (using a smaller range)
            const saltRounds = [8, 10, 12];
            
            for (const rounds of saltRounds) {
                // Generate hash with current salt rounds
                const hashedPassword = await bcrypt.hash(testPassword, rounds);
                console.log(`Testing with salt rounds: ${rounds}, hash: ${hashedPassword}`);

                // Mock database query for successful login
                const mockPool = {
                    query: sandbox.stub().resolves({
                        rows: [{
                            user_id: testUserId,
                            hash: hashedPassword
                        }]
                    }),
                    end: sandbox.stub().resolves()
                };

                // Create a new app instance for this test
                const app = express();
                app.use(express.urlencoded({ extended: true }));
                app.use(session(testSessionConfig));
                app.use(passport.initialize());
                app.use(passport.session());

                // Setup passport serialization
                passport.serializeUser((user: any, done) => {
                    done(null, user);
                });
                passport.deserializeUser((user: any, done) => {
                    done(null, user);
                });

                app.get('/config', (req, res) => res.json(mockConfig));
                app.use(
                    createAuthPluginRouter({
                        passport: passport as any,
                        dbPool: mockPool as any,
                        externalUrl: 'http://localhost:6100',
                        authPluginRedirectUrl: '/sign-in-redirect'
                    })
                );

                const response = await request(app)
                    .post('/')
                    .type('form')
                    .send({
                        username: testUsername,
                        password: testPassword
                    })
                    .expect(302);

                expect(response.header.location).to.include('http://localhost:6100/sign-in-redirect?result=success');
            }
        });

        it('should handle failed login with invalid credentials', async () => {
            // Generate a proper bcrypt hash for a different password
            const storedPassword = 'stored-password';
            const hashedPassword = await bcrypt.hash(storedPassword, 12);

            // Mock database query for failed login
            const mockPool = {
                query: sandbox.stub().resolves({
                    rows: [{
                        user_id: 'test-user-id',
                        hash: hashedPassword
                    }]
                }),
                end: sandbox.stub().resolves()
            };

            // Create a new app instance with the failed login pool
            const failApp = express();
            failApp.use(express.urlencoded({ extended: true }));
            failApp.use(session(testSessionConfig));
            failApp.use(passport.initialize());
            failApp.use(passport.session());

            // Setup passport serialization
            passport.serializeUser((user: any, done) => {
                done(null, user);
            });
            passport.deserializeUser((user: any, done) => {
                done(null, user);
            });

            failApp.get('/config', (req, res) => res.json(mockConfig));
            failApp.use(
                createAuthPluginRouter({
                    passport: passport as any,
                    dbPool: mockPool as any,
                    externalUrl: 'http://localhost:6100',
                    authPluginRedirectUrl: '/sign-in-redirect'
                })
            );

            const response = await request(failApp)
                .post('/')
                .type('form')
                .send({
                    username: 'test@example.com',
                    password: 'invalid-password'
                })
                .expect(302);

            expectFailureRedirect(response, 'AuthenticationError: Unauthorized');
        });

        it('should handle login with empty username', async () => {
            const response = await request(app)
                .post('/')
                .type('form')
                .send({
                    username: '',
                    password: 'any-password'
                })
                .expect(302);

            expectFailureRedirect(response, 'AuthenticationError: Bad Request');
        });

        it('should handle login with missing password', async () => {
            const response = await request(app)
                .post('/')
                .type('form')
                .send({
                    username: 'test@example.com'
                })
                .expect(302);

            expectFailureRedirect(response, 'AuthenticationError: Bad Request');
        });
    });

    describe('Error Handling', () => {
        it('should handle database connection errors', async () => {
            // Mock database error
            const mockPool = {
                query: sandbox.stub().rejects(new Error('Database connection failed')),
                end: sandbox.stub().resolves()
            };
            
            // Create a new app instance with the error-throwing pool
            const errorApp = express();
            errorApp.use(express.urlencoded({ extended: true }));
            errorApp.use(session(testSessionConfig));
            errorApp.use(passport.initialize());
            errorApp.use(passport.session());

            // Setup passport serialization
            passport.serializeUser((user: any, done) => {
                done(null, user);
            });
            passport.deserializeUser((user: any, done) => {
                done(null, user);
            });

            errorApp.get('/config', (req, res) => res.json(mockConfig));
            errorApp.use(
                createAuthPluginRouter({
                    passport: passport as any,
                    dbPool: mockPool as any,
                    externalUrl: 'http://localhost:6100',
                    authPluginRedirectUrl: '/sign-in-redirect'
                })
            );

            const response = await request(errorApp)
                .post('/')
                .type('form')
                .send({
                    username: 'test@example.com',
                    password: 'any-password'
                })
                .expect(302);

            expectFailureRedirect(response, 'system error');
        });

        it('should handle system errors during authentication', async () => {
            // Mock database error
            const mockPool = {
                query: sandbox.stub().rejects(new Error('System error during authentication')),
                end: sandbox.stub().resolves()
            };
            
            // Create a new app instance with the error-throwing pool
            const errorApp = express();
            errorApp.use(express.urlencoded({ extended: true }));
            errorApp.use(session(testSessionConfig));
            errorApp.use(passport.initialize());
            errorApp.use(passport.session());

            // Setup passport serialization
            passport.serializeUser((user: any, done) => {
                done(null, user);
            });
            passport.deserializeUser((user: any, done) => {
                done(null, user);
            });

            errorApp.get('/config', (req, res) => res.json(mockConfig));
            errorApp.use(
                createAuthPluginRouter({
                    passport: passport as any,
                    dbPool: mockPool as any,
                    externalUrl: 'http://localhost:6100',
                    authPluginRedirectUrl: '/sign-in-redirect'
                })
            );

            const response = await request(errorApp)
                .post('/')
                .type('form')
                .send({
                    username: 'test@example.com',
                    password: 'any-password'
                })
                .expect(302);

            expectFailureRedirect(response, 'system error');
        });
    });
});